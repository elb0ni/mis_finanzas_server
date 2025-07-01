import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection } from 'mysql2/promise';
import { createFixedCost } from './dto/createFixedCost.dto';
import { UpdateFixedCostDto } from './dto/updateFixedCost.dto';

@Injectable()
export class FinancialAnalysisService {
  constructor(
    @Inject('MYSQL') private pool: Pool,
    @Inject('MYSQL_CLIENTS') private poolClient: Pool,
  ) { }

  async getSummaryDay(userId, businessId, fecha) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      const [businessRows]: [any[], any] = await connection.query(
        'SELECT * FROM negocios WHERE id = ? AND propietario = ?',
        [businessId, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder a él',
          HttpStatus.NOT_FOUND,
        );
      }

      const [response] = await connection.query(
        `
        SELECT 
            COALESCE(totales.total_egresos, 0) AS total_egresos,
            COALESCE(totales.total_ingresos, 0) AS total_ingresos,
            COALESCE(productos.total_productos_vendidos, 0) AS total_productos_vendidos
        FROM (
            -- Subconsulta para totales de transacciones (sin duplicación)
            SELECT 
                SUM(CASE WHEN t.tipo = 'egreso' THEN t.monto_total ELSE 0 END) AS total_egresos,
                SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto_total ELSE 0 END) AS total_ingresos
            FROM users u
            INNER JOIN negocios n ON u.id = n.propietario
            INNER JOIN puntos_venta pv ON n.id = pv.negocio_id
            INNER JOIN transacciones t ON pv.id = t.punto_venta_id
            WHERE u.id = ?
            AND DATE(t.fecha) = ?
        ) AS totales
        CROSS JOIN (
            -- Subconsulta para cantidad de productos vendidos
            SELECT SUM(dt.cantidad) AS total_productos_vendidos
            FROM users u
            INNER JOIN negocios n ON u.id = n.propietario
            INNER JOIN puntos_venta pv ON n.id = pv.negocio_id
            INNER JOIN transacciones t ON pv.id = t.punto_venta_id
            INNER JOIN detalle_transacciones dt ON t.id = dt.transaccion_id
            WHERE u.id = ?
            AND DATE(t.fecha) = ?
            AND t.tipo = 'ingreso'  -- Solo las transacciones de venta tienen productos
        ) AS productos;`,
        [userId, fecha, userId, fecha],
      );

      return response[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al verificar la configuración',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async getProductProfitSummary(
    userId: string,
    businessId: number,
    fechaInicio?: string,
    fechaFin?: string,
  ) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      const [businessRows]: [any[], any] = await connection.query(
        'SELECT * FROM negocios WHERE id = ? AND propietario = ?',
        [businessId, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder a él',
          HttpStatus.NOT_FOUND,
        );
      }

      let fechaCondition = '';
      let fechaParams: any = [];

      if (fechaInicio && fechaFin) {
        fechaCondition = 'AND DATE(t.fecha) BETWEEN ? AND ?';
        fechaParams = [fechaInicio, fechaFin];
      } else if (fechaInicio) {
        fechaCondition = 'AND DATE(t.fecha) >= ?';
        fechaParams = [fechaInicio];
      } else if (fechaFin) {
        fechaCondition = 'AND DATE(t.fecha) <= ?';
        fechaParams = [fechaFin];
      }

      const [productProfits] = await connection.query(
        `
      SELECT 
          p.id as producto_id,
          p.nombre as producto_nombre,
          p.precio_unitario,
          p.costo_unitario,
          (p.precio_unitario - p.costo_unitario) as ganancia_unitaria,
          COALESCE(SUM(dt.cantidad), 0) as cantidad_vendida,
          COALESCE(SUM(dt.cantidad * (p.precio_unitario - p.costo_unitario)), 0) as ganancia_total,
          CASE 
              WHEN p.precio_unitario > 0 
              THEN ROUND(((p.precio_unitario - p.costo_unitario) / p.precio_unitario) * 100, 2)
              ELSE 0 
          END as margen_ganancia_porcentaje
      FROM productos p
      LEFT JOIN detalle_transacciones dt ON p.id = dt.producto_id
      LEFT JOIN transacciones t ON dt.transaccion_id = t.id AND t.tipo = 'ingreso'
      LEFT JOIN puntos_venta pv ON t.punto_venta_id = pv.id
      WHERE p.negocio_id = ?
      AND p.activo = 1
      ${fechaCondition}
      GROUP BY p.id, p.nombre, p.precio_unitario, p.costo_unitario
      ORDER BY ganancia_total DESC;
      `,
        [businessId, ...fechaParams],
      );

      // Calcular estadísticas generales
      const [generalStats] = await connection.query(
        `
      WITH productos_base AS (
    SELECT 
        p.id,
        p.precio_unitario,
        p.costo_unitario,
        (p.precio_unitario - p.costo_unitario) as ganancia_unitaria,
        CASE 
            WHEN p.precio_unitario > 0 
            THEN ((p.precio_unitario - p.costo_unitario) / p.precio_unitario) * 100 
            ELSE 0 
        END as margen_porcentaje
    FROM productos p
    WHERE p.negocio_id = ? AND p.activo = 1
),
ventas_agregadas AS (
    SELECT 
        p.id,
        COALESCE(SUM(dt.cantidad * (p.precio_unitario - p.costo_unitario)), 0) as ganancia_producto,
        COALESCE(SUM(dt.cantidad), 0) as cantidad_vendida
    FROM productos p
    LEFT JOIN detalle_transacciones dt ON p.id = dt.producto_id
    LEFT JOIN transacciones t ON dt.transaccion_id = t.id AND t.tipo = 'ingreso'
    LEFT JOIN puntos_venta pv ON t.punto_venta_id = pv.id
    WHERE p.negocio_id = ? 
    AND p.activo = 1
    ${fechaCondition}
    GROUP BY p.id
)
SELECT
    COUNT(pb.id) as total_productos,
    AVG(pb.ganancia_unitaria) as ganancia_promedio_unitaria,
    SUM(va.ganancia_producto) as ganancia_total_negocio,
    SUM(va.cantidad_vendida) as total_productos_vendidos,
    AVG(pb.margen_porcentaje) as margen_promedio_porcentaje
FROM productos_base pb
LEFT JOIN ventas_agregadas va ON pb.id = va.id;
      `,
        [businessId, businessId, ...fechaParams],
      );

      // Productos más y menos rentables
      const [topProducts] = await connection.query(
        `
      SELECT 
          p.nombre,
          SUM(dt.cantidad * (p.precio_unitario - p.costo_unitario)) as ganancia_total
      FROM productos p
      INNER JOIN detalle_transacciones dt ON p.id = dt.producto_id
      INNER JOIN transacciones t ON dt.transaccion_id = t.id AND t.tipo = 'ingreso'
      INNER JOIN puntos_venta pv ON t.punto_venta_id = pv.id
      WHERE p.negocio_id = ?
      AND p.activo = 1
      ${fechaCondition}
      GROUP BY p.id, p.nombre
      HAVING ganancia_total > 0
      ORDER BY ganancia_total DESC
      LIMIT 5;
      `,
        [businessId, ...fechaParams],
      );

      const [worstProducts] = await connection.query(
        `
      SELECT 
          p.nombre,
          SUM(dt.cantidad * (p.precio_unitario - p.costo_unitario)) as ganancia_total
      FROM productos p
      INNER JOIN detalle_transacciones dt ON p.id = dt.producto_id
      INNER JOIN transacciones t ON dt.transaccion_id = t.id AND t.tipo = 'ingreso'
      INNER JOIN puntos_venta pv ON t.punto_venta_id = pv.id
      WHERE p.negocio_id = ?
      AND p.activo = 1
      ${fechaCondition}
      GROUP BY p.id, p.nombre
      ORDER BY ganancia_total ASC
      LIMIT 5;
      `,
        [businessId, ...fechaParams],
      );

      return {
        productos: productProfits,
        estadisticas_generales: {
          total_productos: generalStats[0].total_productos,
          ganancia_promedio_unitaria: parseFloat(
            generalStats[0].ganancia_promedio_unitaria,
          ),
          ganancia_total_negocio: parseFloat(
            generalStats[0].ganancia_total_negocio,
          ),
          total_productos_vendidos: generalStats[0].total_productos_vendidos,
          margen_promedio_porcentaje: parseFloat(
            generalStats[0].margen_promedio_porcentaje,
          ),
        },
        productos_mas_rentables: topProducts,
        productos_menos_rentables: worstProducts,
        periodo: {
          fecha_inicio: fechaInicio || 'Sin filtro',
          fecha_fin: fechaFin || 'Sin filtro',
        },
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener la ganancia por producto',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async getFixedCostConfiguration(businessId: number, userId: string) {
    let connection: PoolConnection | null = null;

    try {
      connection = await this.pool.getConnection();

      // Verificar que el negocio existe y pertenece al usuario
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [businessId, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder a él',
          HttpStatus.NOT_FOUND,
        );
      }

      // Obtener los costos fijos
      const [fixedCosts]: [any[], any] = await connection.query(
        `SELECT
         ccf.id,
         ccf.negocio_id,
         ccf.categoria_egreso_id,
         ccf.monto_mensual,
         ccf.descripcion,
         ccf.activo,
         ccf.fecha_creacion,
         ccf.ultima_actualizacion,
         ce.nombre as categoria_nombre
       FROM configuracion_costos_fijos ccf
       JOIN categorias_egresos ce ON ccf.categoria_egreso_id = ce.id
       WHERE ccf.negocio_id = ?
       ORDER BY ccf.fecha_creacion DESC`,
        [businessId],
      );

      return fixedCosts;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Error al obtener los costos fijos: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  async createFixedCostConfiguration(
    userId: string,
    newFixedCost: createFixedCost,
  ) {
    let connection: PoolConnection | null = null;

    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();

      // Verificar que el negocio existe y pertenece al usuario
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id, nombre FROM negocios WHERE id = ? AND propietario = ?',
        [newFixedCost.negocio_id, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder a él',
          HttpStatus.NOT_FOUND,
        );
      }

      // Verificar que la categoría de egreso existe
      const [categoryRows]: [any[], any] = await connection.query(
        'SELECT id, nombre FROM categorias_egresos WHERE id = ?',
        [newFixedCost.categoria_egreso_id],
      );

      if (!categoryRows || categoryRows.length === 0) {
        throw new HttpException(
          'La categoría de egreso especificada no existe',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Insertar la nueva configuración de costo fijo
      const [insertResult]: [any, any] = await connection.query(
        `INSERT INTO configuracion_costos_fijos 
       (negocio_id, categoria_egreso_id, descripcion, monto_mensual)
       VALUES (?, ?, ?, ?)`,
        [
          newFixedCost.negocio_id, // Usar businessId del parámetro para mayor seguridad
          newFixedCost.categoria_egreso_id,
          newFixedCost.descripcion || null,
          newFixedCost.monto_mensual,
        ],
      );

      // Obtener el registro creado para retornarlo
      const [createdRecord]: [any[], any] = await connection.query(
        `SELECT 
         ccf.id,
         ccf.negocio_id,
         ccf.categoria_egreso_id,
         ccf.monto_mensual,
         ccf.descripcion,
         ccf.activo,
         ccf.fecha_creacion,
         ccf.ultima_actualizacion,
         n.nombre as negocio_nombre,
         ce.nombre as categoria_nombre
       FROM configuracion_costos_fijos ccf
       JOIN negocios n ON ccf.negocio_id = n.id
       JOIN categorias_egresos ce ON ccf.categoria_egreso_id = ce.id
       WHERE ccf.id = ?`,
        [insertResult.insertId],
      );

      await connection.commit();

      return {
        success: true,
        message: 'Configuración de costo fijo creada exitosamente',
        data: createdRecord[0],
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      // Si es un error conocido, re-lanzarlo
      if (error instanceof HttpException) {
        throw error;
      }

      // Error genérico
      throw new HttpException(
        `Error al crear la configuración de costo fijo: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  async deleteFixedCostConfiguration(fixedCostId: number, userId: string) {
    let connection: PoolConnection | null = null;

    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();

      // Verificar que la configuración existe y pertenece al usuario
      const [existingRows]: [any[], any] = await connection.query(
        `SELECT ccf.id, ccf.negocio_id, n.nombre as negocio_nombre
       FROM configuracion_costos_fijos ccf
       JOIN negocios n ON ccf.negocio_id = n.id
       WHERE ccf.id = ? AND n.propietario = ?`,
        [fixedCostId, userId],
      );

      if (!existingRows || existingRows.length === 0) {
        throw new HttpException(
          'La configuración de costo fijo no existe o no tienes permisos para eliminarla',
          HttpStatus.NOT_FOUND,
        );
      }

      // Eliminar la configuración de costo fijo
      const [deleteResult]: [any, any] = await connection.query(
        'DELETE FROM configuracion_costos_fijos WHERE id = ?',
        [fixedCostId],
      );

      if (deleteResult.affectedRows === 0) {
        throw new HttpException(
          'No se pudo eliminar la configuración de costo fijo',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      await connection.commit();

      return {
        success: true,
        message: 'Configuración de costo fijo eliminada exitosamente',
        data: {
          id: fixedCostId,
          negocio_id: existingRows[0].negocio_id,
          negocio_nombre: existingRows[0].negocio_nombre,
        },
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Error al eliminar la configuración de costo fijo: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  async updateFixedCostConfiguration(
    userId: string,
    fixedCostId: number,
    updateFixedCostDto: UpdateFixedCostDto,
  ) {
    let connection: PoolConnection | null = null;

    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();

      // Verificar que la configuración existe y pertenece al usuario
      const [fixedCostRows]: [any[], any] = await connection.query(
        `SELECT ccf.*, n.propietario 
       FROM configuracion_costos_fijos ccf 
       JOIN negocios n ON ccf.negocio_id = n.id 
       WHERE ccf.id = ?`,
        [fixedCostId],
      );

      if (!fixedCostRows || fixedCostRows.length === 0) {
        throw new HttpException(
          'La configuración de costo fijo especificada no existe',
          HttpStatus.NOT_FOUND,
        );
      }

      const fixedCost = fixedCostRows[0];

      // Verificar que el negocio de la configuración pertenece al usuario
      if (fixedCost.propietario !== userId) {
        throw new HttpException(
          'No tienes permisos para actualizar esta configuración de costo fijo',
          HttpStatus.FORBIDDEN,
        );
      }

      // Verificar la categoría de egreso si está siendo actualizada
      if (updateFixedCostDto.categoria_egreso_id) {
        const [categoryRows]: [any[], any] = await connection.query(
          'SELECT id FROM categorias_egresos WHERE id = ?',
          [updateFixedCostDto.categoria_egreso_id],
        );

        if (!categoryRows || categoryRows.length === 0) {
          throw new HttpException(
            'La categoría de egreso especificada no existe',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Construir la query de actualización dinámicamente
      const updateFields: any = [];
      const updateValues: any = [];

      // Campos permitidos para actualizar
      const fieldsToUpdate = [
        'categoria_egreso_id',
        'monto_mensual',
        'descripcion',
      ];

      // Construir la lista de campos a actualizar
      fieldsToUpdate.forEach((field) => {
        if (updateFixedCostDto[field] !== undefined) {
          updateFields.push(`${field} = ?`);

          // Para el campo descripción que puede ser null
          if (field === 'descripcion') {
            updateValues.push(updateFixedCostDto[field] || null);
          } else {
            updateValues.push(updateFixedCostDto[field]);
          }
        }
      });

      // Añadir timestamp de actualización
      updateFields.push('ultima_actualizacion = CURRENT_TIMESTAMP');

      // Si no hay campos para actualizar, retornar sin cambios
      if (updateFields.length === 1) {
        // Solo el timestamp
        await connection.commit();

        // Obtener el registro con información completa
        const [currentRecord]: [any[], any] = await connection.query(
          `SELECT 
         ccf.id,
         ccf.negocio_id,
         ccf.categoria_egreso_id,
         ccf.monto_mensual,
         ccf.descripcion,
         ccf.activo,
         ccf.fecha_creacion,
         ccf.ultima_actualizacion,
         n.nombre as negocio_nombre,
         ce.nombre as categoria_nombre
       FROM configuracion_costos_fijos ccf
       JOIN negocios n ON ccf.negocio_id = n.id
       JOIN categorias_egresos ce ON ccf.categoria_egreso_id = ce.id
       WHERE ccf.id = ?`,
          [fixedCostId],
        );

        return {
          success: true,
          message: 'No se realizaron cambios en la configuración',
          data: currentRecord[0],
        };
      }

      // Añadir el ID de la configuración a los valores
      updateValues.push(fixedCostId);

      // Ejecutar la query de actualización
      await connection.query(
        `UPDATE configuracion_costos_fijos SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
      );

      // Obtener el registro actualizado con información completa
      const [updatedRecord]: [any[], any] = await connection.query(
        `SELECT 
       ccf.id,
       ccf.negocio_id,
       ccf.categoria_egreso_id,
       ccf.monto_mensual,
       ccf.descripcion,
       ccf.activo,
       ccf.fecha_creacion,
       ccf.ultima_actualizacion,
       n.nombre as negocio_nombre,
       ce.nombre as categoria_nombre
     FROM configuracion_costos_fijos ccf
     JOIN negocios n ON ccf.negocio_id = n.id
     JOIN categorias_egresos ce ON ccf.categoria_egreso_id = ce.id
     WHERE ccf.id = ?`,
        [fixedCostId],
      );

      await connection.commit();

      return {
        success: true,
        message: 'Configuración de costo fijo actualizada exitosamente',
        data: updatedRecord[0],
      };
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Error al actualizar la configuración de costo fijo: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  async getBalancePoint(businessId, año, mes, userId, autoGenerateCosts = false) {
    let connection: PoolConnection | null = null;

    try {
      connection = await this.pool.getConnection();

      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [businessId, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder a él',
          HttpStatus.NOT_FOUND,
        );
      }

      // Validar si el usuario tiene configuración de costos fijos
      const [configCostosRows]: [any[], any] = await connection.query(
        `SELECT ccf.id 
       FROM configuracion_costos_fijos ccf 
       WHERE ccf.negocio_id = ? AND ccf.activo = 1`,
        [businessId],
      );

      console.log(configCostosRows);

      if (!configCostosRows || configCostosRows.length === 0) {
        throw new HttpException(
          'MISSING_FIXED_COSTS_CONFIG',
          HttpStatus.PRECONDITION_REQUIRED,
        );
      }

      // Validar si existen datos históricos de costos fijos para el mes/año especificado
      const [historicoCostosRows]: [any[], any] = await connection.query(
        `SELECT hcfm.id, hcfm.monto 
       FROM historico_costos_fijos_mensuales hcfm 
       WHERE hcfm.negocio_id = ? AND hcfm.año = ? AND hcfm.mes = ?`,
        [businessId, año, mes],
      );

      if (!historicoCostosRows || historicoCostosRows.length === 0) {
        throw new HttpException(
          'MISSING_MONTHLY_COSTS',
          HttpStatus.PRECONDITION_REQUIRED,
        );
      }


      const [balancePointData]: [any[], any] = await connection.query(
        `
      WITH costos_fijos_mes AS (
          SELECT
              hcfm.negocio_id,
              hcfm.monto AS total_costos_fijos
          FROM historico_costos_fijos_mensuales hcfm
          WHERE hcfm.negocio_id = ?
              AND hcfm.año = ?
              AND hcfm.mes = ?
      ),
      margen_promedio AS (
          SELECT
              p.negocio_id,
              AVG(p.precio_unitario - p.costo_unitario) AS ganancia_promedio_unitaria,
              AVG(
                  CASE
                      WHEN p.precio_unitario > 0
                      THEN ((p.precio_unitario - p.costo_unitario) / p.precio_unitario) * 100
                      ELSE 0
                  END
              ) AS margen_promedio_porcentaje
          FROM productos p
          WHERE p.negocio_id = ?
              AND p.activo = 1
              AND p.precio_unitario > 0
              AND p.costo_unitario > 0
      ),
      progreso_punto_equilibrio AS (
          SELECT
              pv.negocio_id,
              SUM(dt.cantidad) AS cantidad_vendida,
              SUM(dt.subtotal) AS total_vendido
          FROM transacciones t
          INNER JOIN detalle_transacciones dt ON (t.id = dt.transaccion_id)
          INNER JOIN puntos_venta pv ON (t.punto_venta_id = pv.id)
          WHERE t.tipo = 'ingreso'
              AND pv.negocio_id = ?
              AND YEAR(t.fecha) = ?
              AND MONTH(t.fecha) = ?
              AND dt.producto_id IS NOT NULL
      )
      SELECT
          cf.total_costos_fijos,
          mp.ganancia_promedio_unitaria,
          mp.margen_promedio_porcentaje,
          CASE
              WHEN mp.ganancia_promedio_unitaria > 0
              THEN CEIL(cf.total_costos_fijos / mp.ganancia_promedio_unitaria)
              ELSE 0
          END AS unidades_punto_equilibrio,
          CASE
              WHEN mp.margen_promedio_porcentaje > 0
              THEN cf.total_costos_fijos / (mp.margen_promedio_porcentaje / 100)
              ELSE 0
          END AS ventas_punto_equilibrio_pesos,
          pp.total_vendido,
          pp.cantidad_vendida,
          -- Calcular progreso como porcentaje
          CASE
              WHEN mp.ganancia_promedio_unitaria > 0 AND cf.total_costos_fijos > 0
              THEN ROUND(
                  (pp.cantidad_vendida / CEIL(cf.total_costos_fijos / mp.ganancia_promedio_unitaria)) * 100,
                  2
              )
              ELSE 0
          END AS progreso_unidades_porcentaje,
          CASE
              WHEN mp.margen_promedio_porcentaje > 0 AND cf.total_costos_fijos > 0
              THEN ROUND(
                  (pp.total_vendido / (cf.total_costos_fijos / (mp.margen_promedio_porcentaje / 100))) * 100,
                  2
              )
              ELSE 0
          END AS progreso_ventas_porcentaje
      FROM costos_fijos_mes cf
      CROSS JOIN margen_promedio mp
      CROSS JOIN progreso_punto_equilibrio pp
      WHERE cf.negocio_id = mp.negocio_id
          AND cf.negocio_id = pp.negocio_id;
      `,
        [businessId, año, mes, businessId, businessId, año, mes],
      );

      return balancePointData;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al calcular el punto de equilibrio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async prueba() {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.poolClient.getConnection();

      const [info]: [any[], any] = await connection.query(
        'select * from cedula c',
      );
      return info;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al verificar la configuración',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }
}
