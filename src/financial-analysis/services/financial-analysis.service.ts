import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection } from 'mysql2/promise';
import { ConfigVerificationResponseDto } from '../dto/config-verification.dto';
import { QuickConfirmationDto } from '../dto/quick-confirmation.dto';

@Injectable()
export class FinancialAnalysisService {
  constructor(
    @Inject('MYSQL') private pool: Pool,
    @Inject('MYSQL_CLIENTS') private poolClient: Pool,
  ) {}

  async verifyCurrentMonthConfig(
    userId: string,
    businessId: number,
    pointOfSaleId?: number,
  ) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();
      // Verificar que el negocio pertenece al usuario
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT * FROM negocios WHERE id = ? AND propietario = ?',
        [businessId, userId],
      );

      console.log('businessRows => ', businessRows);

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder a él',
          HttpStatus.NOT_FOUND,
        );
      }

      // Obtener mes actual en formato YYYY-MM
      const currentMonth = new Date().toISOString().slice(0, 7);

      console.log('currentMonth => ', currentMonth);

      // Verificar si existe configuración para el mes actual
      const [configRows]: [any[], any] = await connection.query(
        `SELECT * 
                    FROM configuracion_analisis 
                WHERE negocio_id = ? 
                    AND (punto_venta_id = ? OR (punto_venta_id IS NULL AND ? IS NULL))
                    AND mes_aplicacion = ?
                ORDER BY ultima_actualizacion DESC
                    LIMIT 1`,
        [businessId, pointOfSaleId, pointOfSaleId, currentMonth],
      );

      console.log('configRows => ', configRows);
      const hasCurrentConfig = configRows && configRows.length > 0;

      // Verificar necesidad de revisión trimestral
      let needsTrimestrialReview = false;
      let lastTrimestrialReview: any = null;

      if (hasCurrentConfig) {
        // Si ya hay config para este mes, verificar fecha de última revisión trimestral
        const [trimestrialRows]: [any[], any] = await connection.query(
          `SELECT * 
                        FROM configuracion_analisis 
                    WHERE negocio_id = ? 
                        AND (punto_venta_id = ? OR (punto_venta_id IS NULL AND ? IS NULL))
                        AND tipo_actualizacion = 'trimestral'
                    ORDER BY fecha_confirmacion DESC
                        LIMIT 1`,
          [businessId, pointOfSaleId, pointOfSaleId],
        );

        if (trimestrialRows && trimestrialRows.length > 0) {
          lastTrimestrialReview = new Date(
            trimestrialRows[0].fecha_confirmacion,
          );
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

          needsTrimestrialReview = lastTrimestrialReview < threeMonthsAgo;
        } else {
          // Si nunca ha habido revisión trimestral, la necesita
          needsTrimestrialReview = true;
        }
      }

      // Obtener la última configuración (para mes anterior o actual)
      const [lastConfigRows]: [any[], any] = await connection.query(
        `SELECT * 
                FROM configuracion_analisis 
                WHERE negocio_id = ? 
                AND (punto_venta_id = ? OR (punto_venta_id IS NULL AND ? IS NULL))
                ORDER BY mes_aplicacion DESC, ultima_actualizacion DESC
                LIMIT 1`,
        [businessId, pointOfSaleId, pointOfSaleId],
      );

      // Detectar cambios significativos en patrones de gasto
      let changesDetected = false;
      if (lastConfigRows && lastConfigRows.length > 0) {
        const lastConfig = lastConfigRows[0];
        changesDetected = await this.detectSignificantChanges(
          connection,
          businessId,
          pointOfSaleId,
          lastConfig.costos_fijos_estimados,
        );
      }

      // Determinar si se debe bloquear el dashboard
      const blockDashboard = !hasCurrentConfig || needsTrimestrialReview;

      // Preparar mensaje apropiado
      let message = '';
      if (!hasCurrentConfig) {
        message =
          'Se requiere actualizar la configuración financiera para el mes actual.';
      } else if (needsTrimestrialReview) {
        message =
          'Han pasado 3 meses desde la última revisión trimestral. Se requiere una revisión detallada.';
      } else if (changesDetected) {
        message =
          'Hemos detectado cambios significativos en tus patrones de gasto. Te recomendamos revisar tu configuración.';
      } else {
        message = 'Tu configuración financiera está actualizada.';
      }

      return {
        hasCurrentConfig,
        needsTrimestrialReview,
        changesDetected,
        lastConfig:
          lastConfigRows && lastConfigRows.length > 0
            ? lastConfigRows[0]
            : undefined,
        message,
        blockDashboard,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al verificar la configuración',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  private async detectSignificantChanges(
    connection: PoolConnection,
    businessId: number,
    pointOfSaleId: number | null | undefined,
    configuredFixedCosts: number,
  ): Promise<boolean> {
    try {
      // Obtener los últimos dos meses
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const twoMonthsAgoStr = twoMonthsAgo.toISOString().slice(0, 10);

      // Obtener gastos fijos reales de los últimos dos meses
      let query, params;

      if (pointOfSaleId) {
        query = `
              SELECT 
                SUM(t.monto_total) as total_costos_fijos
              FROM 
                transacciones t
                JOIN categorias_egresos ce ON t.categoria_id = ce.id
              WHERE 
                t.punto_venta_id = ? AND
                t.tipo = 'egreso' AND 
                ce.tipo_costo = 'fijo' AND
                t.fecha >= ?
            `;
        params = [pointOfSaleId, twoMonthsAgoStr];
      } else {
        query = `
              SELECT 
                SUM(t.monto_total) as total_costos_fijos
              FROM 
                transacciones t
                JOIN categorias_egresos ce ON t.categoria_id = ce.id
                JOIN puntos_venta pv ON t.punto_venta_id = pv.id
              WHERE 
                pv.negocio_id = ? AND
                t.tipo = 'egreso' AND 
                ce.tipo_costo = 'fijo' AND
                t.fecha >= ?
            `;
        params = [businessId, twoMonthsAgoStr];
      }

      const [results]: [any[], any] = await connection.query(query, params);

      const actualFixedCosts = results[0]?.total_costos_fijos || 0;

      // Si los costos reales difieren en más del 20% de lo configurado
      if (actualFixedCosts > 0) {
        const deviation = Math.abs(
          (actualFixedCosts - configuredFixedCosts) / configuredFixedCosts,
        );
        return deviation > 0.2; // 20% de desviación
      }

      return false;
    } catch (error) {
      console.error('Error detectando cambios en patrones de gasto:', error);
      return false;
    }
  }
  async quickConfirmCurrentConfig(userId: string, data: QuickConfirmationDto) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verificar que el negocio pertenece al usuario
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT * FROM negocios WHERE id = ? AND propietario = ?',
        [data.businessId, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder a él',
          HttpStatus.NOT_FOUND,
        );
      }

      // Obtener la configuración anterior
      const [configRows]: [any[], any] = await connection.query(
        'SELECT * FROM configuracion_analisis WHERE id = ?',
        [data.currentConfigId],
      );

      if (!configRows || configRows.length === 0) {
        throw new HttpException(
          'No se encontró la configuración de referencia',
          HttpStatus.NOT_FOUND,
        );
      }

      const previousConfig = configRows[0];

      // Obtener mes actual en formato YYYY-MM
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Crear nueva configuración para el mes actual basada en la anterior
      await connection.query(
        `INSERT INTO configuracion_analisis (
              negocio_id,
              punto_venta_id,
              costos_fijos_estimados,
              margen_contribucion_estimado,
              dias_semana_activos,
              proyeccion_crecimiento,
              mes_aplicacion,
              tipo_actualizacion,
              fecha_confirmacion,
              cambios_detectados
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          data.businessId,
          data.pointOfSaleId || null,
          previousConfig.costos_fijos_estimados,
          previousConfig.margen_contribucion_estimado,
          previousConfig.dias_semana_activos,
          previousConfig.proyeccion_crecimiento,
          currentMonth,
          'confirmacion',
          false,
        ],
      );

      return {
        success: true,
        message: 'Configuración confirmada para el mes actual',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al confirmar la configuración',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

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

      console.log('inicio');

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

      console.log('fin');
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
  async getProductProfitSummary(userId: string, businessId: number, fechaInicio?: string, fechaFin?: string) {
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
    let fechaParams:any = [];
    
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
      [businessId,businessId, ...fechaParams],
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
        ganancia_promedio_unitaria: parseFloat(generalStats[0].ganancia_promedio_unitaria),
        ganancia_total_negocio: parseFloat(generalStats[0].ganancia_total_negocio),
        total_productos_vendidos: generalStats[0].total_productos_vendidos,
        margen_promedio_porcentaje: parseFloat(generalStats[0].margen_promedio_porcentaje)
      },
      productos_mas_rentables: topProducts,
      productos_menos_rentables: worstProducts,
      periodo: {
        fecha_inicio: fechaInicio || 'Sin filtro',
        fecha_fin: fechaFin || 'Sin filtro'
      }
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
}
