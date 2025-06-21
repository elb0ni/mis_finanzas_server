import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  Pool,
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from 'mysql2/promise';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(@Inject('MYSQL') private pool: Pool) {}

  async getDepartments() {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      const [rows] = await connection.query('SELECT * FROM departamentos');

      const departments = rows as any[];

      if (departments.length === 0) {
        throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
      }

      return departments;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener usuarios',
        error.status,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async getMunicipalities(departmentId: any) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      const [rows] = await connection.query(
        'select id_municipio ,municipio  from municipios m where departamento_id = ?',
        [departmentId],
      );

      const departments = rows as any[];

      if (departments.length === 0) {
        throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
      }

      return departments;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener usuarios',
        error.status,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async generateFixedCosts(negocioId: number, año?: number, mes?: number) {
    const now = new Date();
    const targetAño = año || now.getFullYear();
    const targetMes = mes || now.getMonth() + 1;

    await this.generarCostosFijosPorNegocio(negocioId, targetAño, targetMes);

    return {
      message: `Costos fijos generados para ${targetMes}/${targetAño}`,
      negocioId,
      año: targetAño,
      mes: targetMes,
    };
  }

  async generarCostosFijosPorNegocio(
    negocioId: number,
    año: number,
    mes: number,
  ) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      const query = `
      INSERT INTO historico_costos_fijos_mensuales (
        negocio_id,
        año,
        mes,
        monto,
        origen,
        observaciones
      )
      SELECT 
        ccf.negocio_id AS negocio_id,
        ? AS año,
        ? AS mes,
        SUM(ccf.monto_mensual) AS monto,
        'configuracion' AS origen,
        CONCAT('Suma automática de ', COUNT(*), ' costos fijos configurados') AS observaciones
      FROM configuracion_costos_fijos ccf
      WHERE ccf.negocio_id = ?
      AND ccf.activo = 1
      AND NOT EXISTS (
        SELECT 1 
        FROM historico_costos_fijos_mensuales hcfm 
        WHERE hcfm.negocio_id = ?
        AND hcfm.año = ?
        AND hcfm.mes = ?
      )
      HAVING COUNT(*) > 0
    `;

      const [result]: any = await connection.query(query, [
        año,
        mes,
        negocioId,
        negocioId,
        año,
        mes,
      ]);

      this.logger.log(
        `Costos fijos generados para negocio ${negocioId} - ${mes}/${año}. Registros insertados: ${result.affectedRows}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error generando costos fijos para negocio ${negocioId}: ${error.message}`,
      );
      throw new HttpException(
        error.message || 'Error al generar costos fijos',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }
}
