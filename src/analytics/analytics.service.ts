import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection } from 'mysql2/promise';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject('MYSQL') private pool: Pool,
    @Inject('MYSQL_CLIENTS') private poolClient: Pool,
  ) { }

  //diario 

async getDailyPerformance(fecha, businessId, userId) {
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

    const [dailyPerformanceData]: [any[], any] = await connection.query(
      `WITH 
        -- Fecha de consulta (pasada por el usuario en formato YYYY-MM-DD)
        fecha_input AS (
            SELECT 
                DATE(?) as fecha_consulta,
                DATE_SUB(DATE(?), INTERVAL 1 DAY) as fecha_ayer
        ),

        -- Datos del día consultado
        datos_hoy AS (
            SELECT
                fi.fecha_consulta,
                -- Ventas (ingresos)
                COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN dt.subtotal ELSE 0 END), 0) as ventas_hoy,
                COALESCE(COUNT(CASE WHEN t.tipo = 'ingreso' THEN t.id ELSE NULL END), 0) as transacciones_ingresos_hoy,
                
                -- Gastos (egresos)
                COALESCE(SUM(CASE WHEN t.tipo = 'egreso' THEN t.monto_total ELSE 0 END), 0) as gastos_hoy,
                COALESCE(COUNT(CASE WHEN t.tipo = 'egreso' THEN t.id ELSE NULL END), 0) as transacciones_egresos_hoy,
                
                -- Total transacciones
                COALESCE(COUNT(t.id), 0) as total_transacciones_hoy,
                
                -- Productos vendidos (solo de ingresos)
                COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN dt.cantidad ELSE 0 END), 0) as productos_vendidos_hoy
                
            FROM fecha_input fi
            LEFT JOIN puntos_venta pv ON pv.negocio_id = ?
            LEFT JOIN transacciones t ON pv.id = t.punto_venta_id 
                AND DATE(t.fecha) = fi.fecha_consulta
            LEFT JOIN detalle_transacciones dt ON t.id = dt.transaccion_id
            GROUP BY fi.fecha_consulta
        ),

        -- Datos del día anterior
        datos_ayer AS (
            SELECT
                fi.fecha_ayer,
                -- Ventas (ingresos)
                COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN dt.subtotal ELSE 0 END), 0) as ventas_ayer,
                
                -- Gastos (egresos)
                COALESCE(SUM(CASE WHEN t.tipo = 'egreso' THEN t.monto_total ELSE 0 END), 0) as gastos_ayer
                
            FROM fecha_input fi
            LEFT JOIN puntos_venta pv ON pv.negocio_id = ?
            LEFT JOIN transacciones t ON pv.id = t.punto_venta_id 
                AND DATE(t.fecha) = fi.fecha_ayer
            LEFT JOIN detalle_transacciones dt ON t.id = dt.transaccion_id
            GROUP BY fi.fecha_ayer
        )

        SELECT
            -- Información de fecha
            dh.fecha_consulta,
            DATE_FORMAT(dh.fecha_consulta, '%d/%m/%Y') as fecha_formateada,
            DAYNAME(dh.fecha_consulta) as dia_semana,
            
            -- Métricas principales del día
            dh.ventas_hoy as ventas_registradas,
            dh.gastos_hoy as gastos_registrados,
            (dh.ventas_hoy - dh.gastos_hoy) as utilidad_dia,
            
            -- Formateo de métricas principales
            CASE
                WHEN dh.ventas_hoy >= 1000000 THEN CONCAT(ROUND(dh.ventas_hoy / 1000000, 1), 'M')
                WHEN dh.ventas_hoy >= 1000 THEN CONCAT(ROUND(dh.ventas_hoy / 1000, 1), 'K')
                ELSE CAST(dh.ventas_hoy AS CHAR)
            END as ventas_formatted,
            
            CASE
                WHEN dh.gastos_hoy >= 1000000 THEN CONCAT(ROUND(dh.gastos_hoy / 1000000, 1), 'M')
                WHEN dh.gastos_hoy >= 1000 THEN CONCAT(ROUND(dh.gastos_hoy / 1000, 1), 'K')
                ELSE CAST(dh.gastos_hoy AS CHAR)
            END as gastos_formatted,
            
            CASE
                WHEN ABS(dh.ventas_hoy - dh.gastos_hoy) >= 1000000 THEN 
                    CONCAT(ROUND((dh.ventas_hoy - dh.gastos_hoy) / 1000000, 1), 'M')
                WHEN ABS(dh.ventas_hoy - dh.gastos_hoy) >= 1000 THEN 
                    CONCAT(ROUND((dh.ventas_hoy - dh.gastos_hoy) / 1000, 1), 'K')
                ELSE CAST((dh.ventas_hoy - dh.gastos_hoy) AS CHAR)
            END as utilidad_formatted,
            
            -- Comparación con ayer (porcentajes)
            CASE 
                WHEN da.ventas_ayer = 0 AND dh.ventas_hoy > 0 THEN 100
                WHEN da.ventas_ayer = 0 THEN 0
                ELSE ROUND(((dh.ventas_hoy - da.ventas_ayer) / da.ventas_ayer) * 100, 1)
            END as variacion_ventas_porcentaje,
            
            CASE 
                WHEN da.gastos_ayer = 0 AND dh.gastos_hoy > 0 THEN 100
                WHEN da.gastos_ayer = 0 THEN 0
                ELSE ROUND(((dh.gastos_hoy - da.gastos_ayer) / da.gastos_ayer) * 100, 1)
            END as variacion_gastos_porcentaje,
            
            CASE 
                WHEN (da.ventas_ayer - da.gastos_ayer) = 0 AND (dh.ventas_hoy - dh.gastos_hoy) != 0 THEN 100
                WHEN (da.ventas_ayer - da.gastos_ayer) = 0 THEN 0
                ELSE ROUND((((dh.ventas_hoy - dh.gastos_hoy) - (da.ventas_ayer - da.gastos_ayer)) / (da.ventas_ayer - da.gastos_ayer)) * 100, 1)
            END as variacion_utilidad_porcentaje,
            
            -- Desglose del día
            dh.total_transacciones_hoy as transacciones_realizadas,
            dh.productos_vendidos_hoy as productos_vendidos,
            
            -- Ticket promedio (solo de ventas/ingresos)
            CASE 
                WHEN dh.transacciones_ingresos_hoy > 0 THEN ROUND(dh.ventas_hoy / dh.transacciones_ingresos_hoy, 2)
                ELSE 0 
            END as ticket_promedio,
            
            -- Formateo del ticket promedio
            CASE 
                WHEN dh.transacciones_ingresos_hoy > 0 THEN
                    CASE
                        WHEN (dh.ventas_hoy / dh.transacciones_ingresos_hoy) >= 1000000 THEN 
                            CONCAT(ROUND((dh.ventas_hoy / dh.transacciones_ingresos_hoy) / 1000000, 1), 'M')
                        WHEN (dh.ventas_hoy / dh.transacciones_ingresos_hoy) >= 1000 THEN 
                            CONCAT(ROUND((dh.ventas_hoy / dh.transacciones_ingresos_hoy) / 1000, 1), 'K')
                        ELSE CAST(ROUND(dh.ventas_hoy / dh.transacciones_ingresos_hoy, 2) AS CHAR)
                    END
                ELSE '0'
            END as ticket_promedio_formatted,
            
            -- Margen del día (porcentaje de utilidad sobre ventas)
            CASE 
                WHEN dh.ventas_hoy > 0 THEN ROUND(((dh.ventas_hoy - dh.gastos_hoy) / dh.ventas_hoy) * 100, 1)
                ELSE 0 
            END as margen_dia_porcentaje

        FROM datos_hoy dh
        CROSS JOIN datos_ayer da;`,
      [fecha, fecha, businessId, businessId],
    );

    // Estructurar la respuesta como en tu imagen
    if (dailyPerformanceData.length === 0) {
      return this.createEmptyDailyResponse(fecha);
    }

    const data = dailyPerformanceData[0];
    
    return {
      fecha: {
        fecha_consulta: data.fecha_consulta,
        fecha_formateada: data.fecha_formateada,
        dia_semana: data.dia_semana
      },
      metricas_principales: {
        ventas_registradas: {
          valor: data.ventas_registradas,
          formatted: data.ventas_formatted
        },
        gastos_registrados: {
          valor: data.gastos_registrados,
          formatted: data.gastos_formatted
        },
        utilidad_dia: {
          valor: data.utilidad_dia,
          formatted: data.utilidad_formatted
        }
      },
      comparacion_ayer: {
        ventas: {
          porcentaje: data.variacion_ventas_porcentaje,
          signo: data.variacion_ventas_porcentaje >= 0 ? '+' : '',
          color: data.variacion_ventas_porcentaje >= 0 ? 'green' : 'red'
        },
        gastos: {
          porcentaje: data.variacion_gastos_porcentaje,
          signo: data.variacion_gastos_porcentaje >= 0 ? '+' : '',
          color: data.variacion_gastos_porcentaje >= 0 ? 'red' : 'green' // Inverso porque menos gastos es mejor
        },
        utilidad: {
          porcentaje: data.variacion_utilidad_porcentaje,
          signo: data.variacion_utilidad_porcentaje >= 0 ? '+' : '',
          color: data.variacion_utilidad_porcentaje >= 0 ? 'blue' : 'red'
        }
      },
      desglose_dia: {
        transacciones_realizadas: data.transacciones_realizadas,
        productos_vendidos: data.productos_vendidos,
        ticket_promedio: {
          valor: data.ticket_promedio,
          formatted: data.ticket_promedio_formatted
        },
        margen_dia: {
          porcentaje: data.margen_dia_porcentaje
        }
      }
    };

  } catch (error: any) {
    throw new HttpException(
      error.message || 'Error al obtener el rendimiento diario',
      error.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  } finally {
    if (connection) connection.release();
  }
}

async getDailyBestSellers(fecha, businessId, userId) {
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

    const [dailyBestSellersData]: [any[], any] = await connection.query(
      `WITH
        fecha_input AS (
          SELECT DATE(?) as fecha_consulta
        )
        SELECT
          p.id as producto_id,
          p.nombre as producto_nombre,
          SUM(dt.cantidad) as cantidad_total_vendida,
          SUM(dt.subtotal) as ingresos_generados,
          ROUND(SUM(dt.cantidad * (p.precio_unitario - p.costo_unitario)), 2) as ganancia_total_producto,
          RANK() OVER (ORDER BY SUM(dt.cantidad) DESC) as ranking_por_cantidad,
          ROUND((SUM(dt.cantidad) * 100.0) / (
            SELECT SUM(dt2.cantidad) 
            FROM puntos_venta pv2
            INNER JOIN transacciones t2 ON pv2.id = t2.punto_venta_id
            INNER JOIN detalle_transacciones dt2 ON t2.id = dt2.transaccion_id
            CROSS JOIN fecha_input fi2
            WHERE pv2.negocio_id = ?
              AND t2.tipo = 'ingreso'
              AND DATE(t2.fecha) = fi2.fecha_consulta
          ), 2) as porcentaje_cantidad,
          CASE 
            WHEN SUM(dt.subtotal) >= 1000000 THEN 
              CONCAT(ROUND(SUM(dt.subtotal) / 1000000, 1), 'M')
            WHEN SUM(dt.subtotal) >= 1000 THEN 
              CONCAT(ROUND(SUM(dt.subtotal) / 1000, 1), 'K')
            ELSE 
              CAST(SUM(dt.subtotal) AS CHAR)
          END as ingresos_formatted,
          (SELECT DATE_FORMAT(fecha_consulta, '%d/%m/%Y') FROM fecha_input) as fecha_formateada,
          (SELECT DAYNAME(fecha_consulta) FROM fecha_input) as dia_semana,
          p.precio_unitario,
          p.costo_unitario,
          ROUND((p.precio_unitario - p.costo_unitario), 2) as ganancia_por_unidad
        FROM productos p
        INNER JOIN detalle_transacciones dt ON p.id = dt.producto_id
        INNER JOIN transacciones t ON dt.transaccion_id = t.id
        INNER JOIN puntos_venta pv ON t.punto_venta_id = pv.id
        CROSS JOIN fecha_input fi
        WHERE pv.negocio_id = ?
          AND t.tipo = 'ingreso'
          AND p.activo = 1
          AND DATE(t.fecha) = fi.fecha_consulta
        GROUP BY p.id, p.nombre, p.precio_unitario, p.costo_unitario
        ORDER BY cantidad_total_vendida DESC, ingresos_generados DESC;`,
      [fecha, businessId, businessId],
    );

    return dailyBestSellersData;

  } catch (error: any) {
    throw new HttpException(
      error.message || 'Error al obtener los mejores vendedores del día',
      error.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  } finally {
    if (connection) connection.release();
  }
}

private createEmptyDailyResponse(fecha: string) {
  return {
    fecha: {
      fecha_consulta: fecha,
      fecha_formateada: new Date(fecha).toLocaleDateString('es-ES'),
      dia_semana: new Date(fecha).toLocaleDateString('es-ES', { weekday: 'long' })
    },
    metricas_principales: {
      ventas_registradas: { valor: 0, formatted: '0' },
      gastos_registrados: { valor: 0, formatted: '0' },
      utilidad_dia: { valor: 0, formatted: '0' }
    },
    comparacion_ayer: {
      ventas: { porcentaje: 0, signo: '', color: 'gray' },
      gastos: { porcentaje: 0, signo: '', color: 'gray' },
      utilidad: { porcentaje: 0, signo: '', color: 'gray' }
    },
    desglose_dia: {
      transacciones_realizadas: 0,
      productos_vendidos: 0,
      ticket_promedio: { valor: 0, formatted: '0' },
      margen_dia: { porcentaje: 0 }
    }
  };
}


  //semanal
  async getWeeklyPerformance(fecha, businessId, userId) {
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
      const [weeklyPerformanceData]: [any[], any] = await connection.query(
        `WITH
        fecha_input AS (
          SELECT DATE(?) as fecha_consulta
        ),
        lunes_semana AS (
          SELECT
            fecha_consulta,
            CASE
              WHEN WEEKDAY(fecha_consulta) = 0 THEN fecha_consulta
              ELSE DATE_SUB(fecha_consulta, INTERVAL WEEKDAY(fecha_consulta) DAY)
            END as lunes_fecha
          FROM fecha_input
        ),
        ingresos_por_dia AS (
          SELECT
            DATE(t.fecha) as fecha_dia,
            SUM(t.monto_total) as total_ingresos_dia,
            COUNT(t.id) as total_transacciones_ingreso
          FROM puntos_venta pv
          INNER JOIN transacciones t ON pv.id = t.punto_venta_id
          WHERE pv.negocio_id = ?
            AND t.tipo = 'ingreso'
          GROUP BY DATE(t.fecha)
        ),
        egresos_por_dia AS (
          SELECT
            DATE(t.fecha) as fecha_dia,
            SUM(t.monto_total) as total_egresos_dia,
            COUNT(t.id) as total_transacciones_egreso
          FROM puntos_venta pv
          INNER JOIN transacciones t ON pv.id = t.punto_venta_id
          WHERE pv.negocio_id = ?
            AND t.tipo = 'egreso'
          GROUP BY DATE(t.fecha)
        ),
        productos_vendidos_por_dia AS (
          SELECT
            DATE(t.fecha) as fecha_dia,
            SUM(dt.cantidad) as total_productos_vendidos
          FROM puntos_venta pv
          INNER JOIN transacciones t ON pv.id = t.punto_venta_id
          INNER JOIN detalle_transacciones dt ON t.id = dt.transaccion_id
          WHERE pv.negocio_id = ?
            AND t.tipo = 'ingreso'
          GROUP BY DATE(t.fecha)
        )
        SELECT
          dias.dia_numero,
          DATE_ADD(ls.lunes_fecha, INTERVAL dias.dia_numero - 1 DAY) as fecha_dia,
          dias.nombre_dia,
          DAYNAME(DATE_ADD(ls.lunes_fecha, INTERVAL dias.dia_numero - 1 DAY)) as nombre_dia_db,
          DATE_FORMAT(DATE_ADD(ls.lunes_fecha, INTERVAL dias.dia_numero - 1 DAY), '%d/%m/%Y') as fecha_formateada,
          COALESCE(ipd.total_ingresos_dia, 0) as total_ingresos,
          COALESCE(epd.total_egresos_dia, 0) as total_egresos,
          COALESCE(ipd.total_ingresos_dia, 0) - COALESCE(epd.total_egresos_dia, 0) as ganancia_neta,
          CASE
            WHEN DATE_ADD(ls.lunes_fecha, INTERVAL dias.dia_numero - 1 DAY) = (SELECT fecha_consulta FROM fecha_input) THEN 'SÍ'
            ELSE 'NO'
          END as es_fecha_consultada
        FROM (
          SELECT 1 as dia_numero, 'Lun' as nombre_dia
          UNION ALL SELECT 2, 'Mar'
          UNION ALL SELECT 3, 'Mie'
          UNION ALL SELECT 4, 'Jue'
          UNION ALL SELECT 5, 'Vie'
          UNION ALL SELECT 6, 'Sab'
          UNION ALL SELECT 7, 'Dom'
        ) as dias
        CROSS JOIN lunes_semana ls
        LEFT JOIN ingresos_por_dia ipd ON ipd.fecha_dia = DATE_ADD(ls.lunes_fecha, INTERVAL dias.dia_numero - 1 DAY)
        LEFT JOIN egresos_por_dia epd ON epd.fecha_dia = DATE_ADD(ls.lunes_fecha, INTERVAL dias.dia_numero - 1 DAY)
        LEFT JOIN productos_vendidos_por_dia pvpd ON pvpd.fecha_dia = DATE_ADD(ls.lunes_fecha, INTERVAL dias.dia_numero - 1 DAY)
        ORDER BY dias.dia_numero;`,
        [fecha, businessId, businessId, businessId],
      );

      return weeklyPerformanceData;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Error al calcular el punto de equilibrio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getWeekBestSellers(fecha, businessId, userId) {
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

      const [weeklyBestSellersData]: [any[], any] = await connection.query(
        `WITH
              fecha_input AS (
                SELECT DATE(?) as fecha_consulta
              ),
              lunes_semana AS (
                SELECT
                  fecha_consulta,
                  CASE
                    WHEN WEEKDAY(fecha_consulta) = 0 THEN fecha_consulta
                    ELSE DATE_SUB(fecha_consulta, INTERVAL WEEKDAY(fecha_consulta) DAY)
                  END as lunes_fecha,
                  CASE
                    WHEN WEEKDAY(fecha_consulta) = 0 THEN DATE_ADD(fecha_consulta, INTERVAL 6 DAY)
                    ELSE DATE_ADD(DATE_SUB(fecha_consulta, INTERVAL WEEKDAY(fecha_consulta) DAY), INTERVAL 6 DAY)
                  END as domingo_fecha
                FROM fecha_input
              )
              SELECT
                p.id as producto_id,
                p.nombre as producto_nombre,
                SUM(dt.cantidad) as cantidad_total_vendida,
                SUM(dt.subtotal) as ingresos_generados,
                ROUND(SUM(dt.cantidad * (p.precio_unitario - p.costo_unitario)), 2) as ganancia_total_producto,
                RANK() OVER (ORDER BY SUM(dt.cantidad) DESC) as ranking_por_cantidad,
                ROUND((SUM(dt.cantidad) * 100.0) / (
                  SELECT SUM(dt2.cantidad) 
                  FROM puntos_venta pv2
                  INNER JOIN transacciones t2 ON pv2.id = t2.punto_venta_id
                  INNER JOIN detalle_transacciones dt2 ON t2.id = dt2.transaccion_id
                  CROSS JOIN lunes_semana ls2
                  WHERE pv2.negocio_id = ?
                    AND t2.tipo = 'ingreso'
                    AND DATE(t2.fecha) BETWEEN ls2.lunes_fecha AND ls2.domingo_fecha
                ), 2) as porcentaje_cantidad,
                CASE 
                  WHEN SUM(dt.subtotal) >= 1000000 THEN 
                    CONCAT(ROUND(SUM(dt.subtotal) / 1000000, 1), 'M')
                  WHEN SUM(dt.subtotal) >= 1000 THEN 
                    CONCAT(ROUND(SUM(dt.subtotal) / 1000, 1), 'K')
                  ELSE 
                    CAST(SUM(dt.subtotal) AS CHAR)
                END as ingresos_formatted,
                (SELECT DATE_FORMAT(lunes_fecha, '%d/%m/%Y') FROM lunes_semana) as inicio_semana,
                (SELECT DATE_FORMAT(domingo_fecha, '%d/%m/%Y') FROM lunes_semana) as fin_semana
              FROM productos p
              INNER JOIN detalle_transacciones dt ON p.id = dt.producto_id
              INNER JOIN transacciones t ON dt.transaccion_id = t.id
              INNER JOIN puntos_venta pv ON t.punto_venta_id = pv.id
              CROSS JOIN lunes_semana ls
              WHERE pv.negocio_id = ?
                AND t.tipo = 'ingreso'
                AND p.activo = 1
                AND DATE(t.fecha) BETWEEN ls.lunes_fecha AND ls.domingo_fecha
              GROUP BY p.id, p.nombre, p.precio_unitario, p.costo_unitario
              ORDER BY cantidad_total_vendida DESC, ingresos_generados DESC;`,
        [fecha, businessId, businessId],
      );

      return weeklyBestSellersData;

    } catch (error) {
      throw new HttpException(
        error.message || 'Error al calcular el punto de equilibrio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  //month

  async getMonthPerformance(fecha, businessId, userId) {
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
      const [monthPerformanceData]: [any[], any] = await connection.query(
        `WITH RECURSIVE
          fecha_input AS (
              SELECT
                  DATE(?) as fecha_consulta,
                  DATE_FORMAT(DATE(?), '%Y-%m-01') as fecha_inicio_intervalo,
                  LAST_DAY(DATE(?)) as fecha_fin_intervalo
          ),
          params AS (
              SELECT
                  fecha_inicio_intervalo,
                  fecha_fin_intervalo
              FROM fecha_input
          ),
          primer_lunes AS (
              SELECT
                  fecha_inicio_intervalo,
                  fecha_fin_intervalo,
                  CASE
                      WHEN WEEKDAY(fecha_inicio_intervalo) = 0 THEN fecha_inicio_intervalo
                      ELSE DATE_ADD(fecha_inicio_intervalo, INTERVAL (7 - WEEKDAY(fecha_inicio_intervalo)) DAY)
                  END as primer_lunes_fecha
              FROM params
          ),
          semanas AS (
              SELECT
                  1 as semana_numero,
                  CONCAT('Sem ', 1) as semana_label,
                  primer_lunes_fecha as fecha_inicio_semana,
                  DATE_ADD(primer_lunes_fecha, INTERVAL 6 DAY) as fecha_fin_semana,
                  fecha_fin_intervalo
              FROM primer_lunes
              WHERE primer_lunes_fecha <= fecha_fin_intervalo

              UNION ALL

              SELECT
                  semana_numero + 1,
                  CONCAT('Sem ', semana_numero + 1),
                  DATE_ADD(fecha_inicio_semana, INTERVAL 7 DAY),
                  DATE_ADD(fecha_fin_semana, INTERVAL 7 DAY),
                  fecha_fin_intervalo
              FROM semanas
              WHERE DATE_ADD(fecha_inicio_semana, INTERVAL 7 DAY) <= fecha_fin_intervalo
          ),
          ingresos_por_semana AS (
              SELECT
                  s.semana_numero,
                  SUM(t.monto_total) as total_ingresos_semana,
                  COUNT(t.id) as total_transacciones_ingresos_semana
              FROM semanas s
              LEFT JOIN puntos_venta pv ON pv.negocio_id =?
              LEFT JOIN transacciones t ON pv.id = t.punto_venta_id
                  AND t.tipo = 'ingreso'
                  AND DATE(t.fecha) BETWEEN s.fecha_inicio_semana AND s.fecha_fin_semana
              GROUP BY s.semana_numero
          ),
          egresos_por_semana AS (
              SELECT
                  s.semana_numero,
                  SUM(t.monto_total) as total_egresos_semana,
                  COUNT(t.id) as total_transacciones_egresos_semana
              FROM semanas s
              LEFT JOIN puntos_venta pv ON pv.negocio_id = ?
              LEFT JOIN transacciones t ON pv.id = t.punto_venta_id
                  AND t.tipo = 'egreso'
                  AND DATE(t.fecha) BETWEEN s.fecha_inicio_semana AND s.fecha_fin_semana
              GROUP BY s.semana_numero
          )
          SELECT
              s.semana_numero,
              s.semana_label,
              s.fecha_inicio_semana,
              s.fecha_fin_semana,
              DATE_FORMAT(s.fecha_inicio_semana, '%d/%m/%Y') as fecha_inicio_formateada,
              DATE_FORMAT(s.fecha_fin_semana, '%d/%m/%Y') as fecha_fin_formateada,
              CASE
                  WHEN CURDATE() BETWEEN s.fecha_inicio_semana AND s.fecha_fin_semana THEN 'SÍ'
                  ELSE 'NO'
              END as es_semana_actual,
              COALESCE(ips.total_ingresos_semana, 0) as total_ingresos,
              COALESCE(eps.total_egresos_semana, 0) as total_egresos
          FROM semanas s
          LEFT JOIN ingresos_por_semana ips ON s.semana_numero = ips.semana_numero
          LEFT JOIN egresos_por_semana eps ON s.semana_numero = eps.semana_numero
          ORDER BY s.semana_numero;`,
        [fecha, fecha, fecha, businessId, businessId],
      );

      return monthPerformanceData;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Error al calcular el punto de equilibrio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  async getMonthBestSellers(fecha, businessId, userId) {
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

      const [monthBestSellersData]: [any[], any] = await connection.query(
        `WITH
            fecha_input AS (
              SELECT
                DATE(?) as fecha_consulta,
                DATE_FORMAT(DATE(?), '%Y-%m-01') as fecha_inicio_mes,
                LAST_DAY(DATE(?)) as fecha_fin_mes
            )
            SELECT
              p.id as producto_id,
              p.nombre as producto_nombre,
              SUM(dt.cantidad) as cantidad_total_vendida,
              SUM(dt.subtotal) as ingresos_generados,
              ROUND(SUM(dt.cantidad * (p.precio_unitario - p.costo_unitario)), 2) as ganancia_total_producto,
              RANK() OVER (ORDER BY SUM(dt.cantidad) DESC) as ranking_por_cantidad,
              ROUND((SUM(dt.cantidad) * 100.0) / (
                SELECT SUM(dt2.cantidad) 
                FROM puntos_venta pv2
                INNER JOIN transacciones t2 ON pv2.id = t2.punto_venta_id
                INNER JOIN detalle_transacciones dt2 ON t2.id = dt2.transaccion_id
                CROSS JOIN fecha_input fi2
                WHERE pv2.negocio_id = ?
                  AND t2.tipo = 'ingreso'
                  AND DATE(t2.fecha) BETWEEN fi2.fecha_inicio_mes AND fi2.fecha_fin_mes
              ), 2) as porcentaje_cantidad,
              CASE 
                WHEN SUM(dt.subtotal) >= 1000000 THEN 
                  CONCAT(ROUND(SUM(dt.subtotal) / 1000000, 1), 'M')
                WHEN SUM(dt.subtotal) >= 1000 THEN 
                  CONCAT(ROUND(SUM(dt.subtotal) / 1000, 1), 'K')
                ELSE 
                  CAST(SUM(dt.subtotal) AS CHAR)
              END as ingresos_formatted,
              (SELECT DATE_FORMAT(fecha_inicio_mes, '%d/%m/%Y') FROM fecha_input) as inicio_mes,
              (SELECT DATE_FORMAT(fecha_fin_mes, '%d/%m/%Y') FROM fecha_input) as fin_mes,
              (SELECT MONTHNAME(fecha_inicio_mes) FROM fecha_input) as nombre_mes,
              (SELECT YEAR(fecha_inicio_mes) FROM fecha_input) as año_mes
            FROM productos p
            INNER JOIN detalle_transacciones dt ON p.id = dt.producto_id
            INNER JOIN transacciones t ON dt.transaccion_id = t.id
            INNER JOIN puntos_venta pv ON t.punto_venta_id = pv.id
            CROSS JOIN fecha_input fi
            WHERE pv.negocio_id = ?
              AND t.tipo = 'ingreso'
              AND p.activo = 1
              AND DATE(t.fecha) BETWEEN fi.fecha_inicio_mes AND fi.fecha_fin_mes
            GROUP BY p.id, p.nombre, p.precio_unitario, p.costo_unitario
            ORDER BY cantidad_total_vendida DESC, ingresos_generados DESC;`,
        [fecha, fecha, fecha, businessId, businessId],
      );

      return monthBestSellersData;

    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener los mejores vendedores del mes',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  //todavia n
  async getWeeklyComparison(fecha, businessId, userId) {
  let connection: PoolConnection | null = null;

  try {
    connection = await this.pool.getConnection();

    // Verificar permisos del negocio
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

    const [comparisonData]: [any[], any] = await connection.query(
      `WITH
    fecha_input AS (
      SELECT DATE(?) as fecha_consulta
    ),
    semanas AS (
      SELECT
        -- Semana actual
        CASE
          WHEN WEEKDAY(fecha_consulta) = 0 THEN fecha_consulta
          ELSE DATE_SUB(fecha_consulta, INTERVAL WEEKDAY(fecha_consulta) DAY)
        END as lunes_actual,
        CASE
          WHEN WEEKDAY(fecha_consulta) = 0 THEN DATE_ADD(fecha_consulta, INTERVAL 6 DAY)
          ELSE DATE_ADD(DATE_SUB(fecha_consulta, INTERVAL WEEKDAY(fecha_consulta) DAY), INTERVAL 6 DAY)
        END as domingo_actual,
        -- Semana anterior
        CASE
          WHEN WEEKDAY(fecha_consulta) = 0 THEN DATE_SUB(fecha_consulta, INTERVAL 7 DAY)
          ELSE DATE_SUB(DATE_SUB(fecha_consulta, INTERVAL WEEKDAY(fecha_consulta) DAY), INTERVAL 7 DAY)
        END as lunes_anterior,
        CASE
          WHEN WEEKDAY(fecha_consulta) = 0 THEN DATE_SUB(fecha_consulta, INTERVAL 1 DAY)
          ELSE DATE_SUB(DATE_SUB(fecha_consulta, INTERVAL WEEKDAY(fecha_consulta) DAY), INTERVAL 1 DAY)
        END as domingo_anterior
      FROM fecha_input
    ),
    ingresos_actual AS (
      SELECT
        SUM(t.monto_total) as total_ingresos
      FROM puntos_venta pv
      INNER JOIN transacciones t ON pv.id = t.punto_venta_id
      CROSS JOIN semanas s
      WHERE pv.negocio_id = ?
        AND t.tipo = 'ingreso'
        AND DATE(t.fecha) BETWEEN s.lunes_actual AND s.domingo_actual
    ),
    ingresos_anterior AS (
      SELECT
        SUM(t.monto_total) as total_ingresos
      FROM puntos_venta pv
      INNER JOIN transacciones t ON pv.id = t.punto_venta_id
      CROSS JOIN semanas s
      WHERE pv.negocio_id = ?
        AND t.tipo = 'ingreso'
        AND DATE(t.fecha) BETWEEN s.lunes_anterior AND s.domingo_anterior
    ),
    productos_vendidos AS (
      SELECT
        SUM(dt.cantidad) as productos_actuales
      FROM puntos_venta pv
      INNER JOIN transacciones t ON pv.id = t.punto_venta_id
      INNER JOIN detalle_transacciones dt ON t.id = dt.transaccion_id
      CROSS JOIN semanas s
      WHERE pv.negocio_id = ?
        AND t.tipo = 'ingreso'
        AND DATE(t.fecha) BETWEEN s.lunes_actual AND s.domingo_actual
    )
    SELECT
      -- Porcentaje de cambio vs semana anterior
      CASE 
        WHEN COALESCE(iant.total_ingresos, 0) = 0 AND COALESCE(iact.total_ingresos, 0) > 0 THEN 100
        WHEN COALESCE(iant.total_ingresos, 0) = 0 THEN 0
        ELSE ROUND(((COALESCE(iact.total_ingresos, 0) - COALESCE(iant.total_ingresos, 0)) / COALESCE(iant.total_ingresos, 0)) * 100, 0)
      END as porcentaje_vs_semana_anterior,
      
      -- Total productos vendidos esta semana
      COALESCE(pv.productos_actuales, 0) as productos_vendidos_semana
      
    FROM ingresos_actual iact
    CROSS JOIN ingresos_anterior iant
    CROSS JOIN productos_vendidos pv;`,
      [fecha, businessId, businessId, businessId],
    );

    return {
      porcentaje_vs_semana_anterior: comparisonData[0]?.porcentaje_vs_semana_anterior || 0,
      productos_vendidos_semana: comparisonData[0]?.productos_vendidos_semana || 0
    };

  } catch (error: any) {
    throw new HttpException(
      error.message || 'Error al obtener comparación semanal',
      error.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  } finally {
    if (connection) connection.release();
  }
}
}
