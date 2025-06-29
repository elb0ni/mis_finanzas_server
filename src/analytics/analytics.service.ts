import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection } from 'mysql2/promise';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject('MYSQL') private pool: Pool,
    @Inject('MYSQL_CLIENTS') private poolClient: Pool,
  ) { }

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
