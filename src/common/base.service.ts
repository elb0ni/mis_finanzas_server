import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'mysql2/promise';

@Injectable()
export abstract class BaseService {
  constructor(
    @Inject('MYSQL') protected pool: Pool,
    @Inject('MYSQL_CLIENTS') protected poolClient: Pool,
  ) {}

  // Método para ejecutar queries SELECT
  protected async executeQuery<T = any>(
    query: string,
    params: any[] = [],
  ): Promise<T[]> {
    try {
      const [rows] = await this.pool.query(query, params);

      if (!Array.isArray(rows)) {
        throw new Error('La consulta no devolvió un array de resultados');
      }

      return rows as T[];
    } catch (error) {
      throw new HttpException(
        `Error en la consulta: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Método para queries que no devuelven filas (INSERT, UPDATE, DELETE)
  protected async executeNonSelectQuery(
    query: string,
    params: any[] = [],
  ): Promise<any> {
    try {
      const [result] = await this.pool.query(query, params);
      return result;
    } catch (error) {
      throw new HttpException(
        `Error en la consulta: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Método para verificar permisos del negocio
  protected async verifyBusinessAccess(
    businessId: number,
    userId: number,
  ): Promise<void> {
    try {
      const [businessRows] = await this.pool.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [businessId, userId],
      );

      if (!Array.isArray(businessRows) || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder a él',
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error al verificar permisos del negocio',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
