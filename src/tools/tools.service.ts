import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  Pool,
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from 'mysql2/promise';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ToolsService {
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
}
