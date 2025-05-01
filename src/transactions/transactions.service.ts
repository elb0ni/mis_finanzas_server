import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection } from 'mysql2/promise';
import { CreateExpenseCategoryDto } from './dto/CreateExpenseCategoryDto ';

@Injectable()
export class TransactionsService {
  constructor(@Inject('MYSQL') private pool: Pool) {}

  // Create a new expense category
  async createExpenseCategory(
    userId: string,
    newCategory: CreateExpenseCategoryDto,
  ) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verify that the business exists and belongs to the user
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [newCategory.negocio_id, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para administrarlo',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Insert the new expense category
      const [result] = await connection.query(
        'INSERT INTO categorias_egresos (negocio_id, nombre, descripcion, tipo_costo, activo) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [
          newCategory.negocio_id,
          newCategory.nombre,
          newCategory.descripcion || null,
          newCategory.tipo_costo,
          newCategory.activo === undefined ? 1 : newCategory.activo ? 1 : 0,
        ],
      );

      const categoryId = result[0].id;

      // Retrieve the newly created category to return it
      const [newCategoryRecord] = await connection.query(
        'SELECT * FROM categorias_egresos WHERE id = ?',
        [categoryId],
      );

      return newCategoryRecord[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear la categoría de egresos',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  // Get all expense categories for a specific business
  async findExpenseCategoriesByBusiness(businessId: number, userId: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verify that the business exists and belongs to the user
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [businessId, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get all expense categories for the business
      const [categories] = await connection.query(
        'SELECT * FROM categorias_egresos WHERE negocio_id = ?',
        [businessId],
      );

      return categories;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener las categorías de egresos',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  // Get a specific expense category by ID
  async findExpenseCategoryById(categoryId: number, userId: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verify that the category exists and belongs to a business owned by the user
      const [categoryRows]: [any[], any] = await connection.query(
        'SELECT ce.* FROM categorias_egresos ce ' +
          'JOIN negocios n ON ce.negocio_id = n.id ' +
          'WHERE ce.id = ? AND n.propietario = ?',
        [categoryId, userId],
      );

      if (!categoryRows || categoryRows.length === 0) {
        throw new HttpException(
          'La categoría no existe o no tienes permisos para acceder',
          HttpStatus.NOT_FOUND,
        );
      }

      return categoryRows[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener la categoría de egresos',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  // Update an expense category
  async updateExpenseCategory(
    categoryId: number,
    userId: string,
    updateData: Partial<CreateExpenseCategoryDto>,
  ) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verify that the category exists and belongs to a business owned by the user
      const [categoryRows]: [any[], any] = await connection.query(
        'SELECT ce.* FROM categorias_egresos ce ' +
          'JOIN negocios n ON ce.negocio_id = n.id ' +
          'WHERE ce.id = ? AND n.propietario = ?',
        [categoryId, userId],
      );

      if (!categoryRows || categoryRows.length === 0) {
        throw new HttpException(
          'La categoría no existe o no tienes permisos para modificarla',
          HttpStatus.NOT_FOUND,
        );
      }

      // Prepare update fields
      const fields: any = [];
      const values: any = [];

      if (updateData.nombre !== undefined) {
        fields.push('nombre = ?');
        values.push(updateData.nombre);
      }

      if (updateData.descripcion !== undefined) {
        fields.push('descripcion = ?');
        values.push(updateData.descripcion || null);
      }

      if (updateData.tipo_costo !== undefined) {
        fields.push('tipo_costo = ?');
        values.push(updateData.tipo_costo);
      }

      if (updateData.activo !== undefined) {
        fields.push('activo = ?');
        values.push(updateData.activo ? 1 : 0);
      }

      // Only proceed if there are fields to update
      if (fields.length > 0) {
        // Add the categoryId to the values array
        values.push(categoryId);

        // Update the category
        await connection.query(
          `UPDATE categorias_egresos SET ${fields.join(', ')} WHERE id = ?`,
          values,
        );
      }

      // Retrieve the updated category
      const [updatedCategory] = await connection.query(
        'SELECT * FROM categorias_egresos WHERE id = ?',
        [categoryId],
      );

      return updatedCategory[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar la categoría de egresos',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  // Delete an expense category
  async deleteExpenseCategory(categoryId: number, userId: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verify that the category exists and belongs to a business owned by the user
      const [categoryRows]: [any[], any] = await connection.query(
        'SELECT ce.* FROM categorias_egresos ce ' +
          'JOIN negocios n ON ce.negocio_id = n.id ' +
          'WHERE ce.id = ? AND n.propietario = ?',
        [categoryId, userId],
      );

      if (!categoryRows || categoryRows.length === 0) {
        throw new HttpException(
          'La categoría no existe o no tienes permisos para eliminarla',
          HttpStatus.NOT_FOUND,
        );
      }

      // Delete the category
      await connection.query('DELETE FROM categorias_egresos WHERE id = ?', [
        categoryId,
      ]);

      return {
        success: true,
        message: 'Categoría de egresos eliminada correctamente',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al eliminar la categoría de egresos',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }
}
