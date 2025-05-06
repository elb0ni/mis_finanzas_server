import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection } from 'mysql2/promise';
import { CreateExpenseCategoryDto } from './dto/CreateExpenseCategoryDto';
import { CreateTransactionDto } from './dto/CreateTransactionDto';

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

  async createTransaction(
    userId: string,
    newTransaction: CreateTransactionDto,
  ) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();

      const [puntoVentaRows]: [any[], any] = await connection.query(
        'SELECT pv.* FROM puntos_venta pv ' +
          'JOIN negocios n ON pv.negocio_id = n.id ' +
          'WHERE pv.id = ? AND n.propietario = ?',
        [newTransaction.punto_venta_id, userId],
      );

      if (!puntoVentaRows || puntoVentaRows.length === 0) {
        throw new HttpException(
          'El punto de venta no existe o no tienes permisos para registrar transacciones en él',
          HttpStatus.NOT_FOUND,
        );
      }

      if (newTransaction.tipo === 'egreso') {
        // Expenses require a category
        if (!newTransaction.categoria_id) {
          throw new HttpException(
            'Las transacciones de tipo egreso deben tener una categoría',
            HttpStatus.BAD_REQUEST,
          );
        }

        const [categoryRows]: [any[], any] = await connection.query(
          'SELECT ce.* FROM categorias_egresos ce ' +
            'JOIN negocios n ON ce.negocio_id = n.id ' +
            'JOIN puntos_venta pv ON pv.negocio_id = n.id ' +
            'WHERE ce.id = ? AND pv.id = ? AND n.propietario = ?',
          [newTransaction.categoria_id, newTransaction.punto_venta_id, userId],
        );

        if (!categoryRows || categoryRows.length === 0) {
          throw new HttpException(
            'La categoría no existe o no pertenece al negocio asociado al punto de venta',
            HttpStatus.BAD_REQUEST,
          );
        }

        if (!newTransaction.monto_total) {
          throw new HttpException(
            'El monto total es requerido para transacciones de egreso',
            HttpStatus.BAD_REQUEST,
          );
        }

        const monto_total = newTransaction.monto_total;

        const [result]: any = await connection.query(
          'INSERT INTO transacciones (punto_venta_id, tipo, fecha, monto_total, categoria_id, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
          [
            newTransaction.punto_venta_id,
            newTransaction.tipo,
            newTransaction.fecha,
            monto_total,
            newTransaction.categoria_id,
            userId,
          ],
        );

        const transactionId = result.insertId;

        await connection.commit();

        const [transactionRows]: [any[], any] = await connection.query(
          'SELECT t.*, ce.nombre as categoria_nombre FROM transacciones t ' +
            'LEFT JOIN categorias_egresos ce ON t.categoria_id = ce.id ' +
            'WHERE t.id = ?',
          [transactionId],
        );

        return transactionRows[0];
      } else {
        if (!newTransaction.detalles || newTransaction.detalles.length === 0) {
          throw new HttpException(
            'Las transacciones de tipo ingreso deben tener al menos un detalle',
            HttpStatus.BAD_REQUEST,
          );
        }

        const productsId = newTransaction.detalles.map(
          (detalle) => detalle.producto_id,
        );

        const [productsRows]: [any[], any] = await connection.query(
          'SELECT p.id, p.precio_unitario, p.nombre, p.unidad_medida FROM productos p ' +
            'JOIN negocios n ON p.negocio_id = n.id ' +
            'JOIN puntos_venta pv ON pv.negocio_id = n.id ' +
            'WHERE p.id IN (?) AND pv.id = ? AND n.propietario = ?',
          [productsId, newTransaction.punto_venta_id, userId],
        );

        if (productsRows.length !== productsId.length) {
          throw new HttpException(
            'Uno o más productos no existen o no pertenecen al negocio asociado al punto de venta',
            HttpStatus.BAD_REQUEST,
          );
        }

        const productMap = {};
        productsRows.forEach((product) => {
          productMap[product.id] = {
            precio_unitario: product.precio_unitario,
            nombre: product.nombre,
            unidad_medida: product.unidad_medida,
          };
        });

        let monto_total = 0;
        const detailsWithPrices = newTransaction.detalles.map((detail) => {
          const product = productMap[detail.producto_id];
          const precio_unitario = product.precio_unitario;
          const subtotal = Number(detail.cantidad * precio_unitario);
          monto_total += subtotal;

          return {
            producto_id: detail.producto_id,
            cantidad: detail.cantidad,
            precio_unitario,
            subtotal,
            producto_nombre: product.nombre,
            unidad_medida: product.unidad_medida,
          };
        });

        if (newTransaction.monto_total !== undefined) {
          const tolerance = 0.01;
          if (Math.abs(monto_total - newTransaction.monto_total) > tolerance) {
            console.log('comparacion', monto_total ,'---', newTransaction.monto_total);
            
            throw new HttpException(
              `El monto total calculado (${monto_total}) no coincide con el monto proporcionado (${newTransaction.monto_total})`,
              HttpStatus.BAD_REQUEST,
            );
          }
        }

        const [result]: any = await connection.query(
          'INSERT INTO transacciones (punto_venta_id, tipo, fecha, monto_total, usuario_id) VALUES (?, ?, ?, ?, ?)',
          [
            newTransaction.punto_venta_id,
            newTransaction.tipo,
            newTransaction.fecha,
            monto_total,
            userId,
          ],
        );

        const transactionId = result.insertId;

        for (const detail of detailsWithPrices) {
          await connection.query(
            'INSERT INTO detalle_transacciones (transaccion_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
            [
              transactionId,
              detail.producto_id,
              detail.cantidad,
              detail.precio_unitario,
              detail.subtotal,
            ],
          );
        }

        await connection.commit();

        return {
          id: transactionId,
          punto_venta_id: newTransaction.punto_venta_id,
          tipo: newTransaction.tipo,
          fecha: newTransaction.fecha,
          monto_total,
          usuario_id: userId,
          detalles: detailsWithPrices,
        };
      }
    } catch (error) {
      if (connection) await connection.rollback();
      throw new HttpException(
        error.message || 'Error al crear la transacción',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }
}
