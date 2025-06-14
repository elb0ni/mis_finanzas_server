import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection } from 'mysql2/promise';
import { CreateExpenseCategoryDto } from './dto/CreateExpenseCategoryDto';
import { CreateTransactionDto } from './dto/CreateTransactionDto';
import { TransactionDateDto } from './dto/TransactionDateDto ';

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
  async findExpenseCategoriesByBusiness(
    businessId: number,
    userId: string,
    tipoCosto?: string,
  ) {
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

      // Build query based on whether tipoCosto filter is provided
      let query = 'SELECT * FROM categorias_egresos WHERE negocio_id = ?';
      let queryParams: any[] = [businessId];

      if (tipoCosto) {
        query += ' AND LOWER(tipo_costo) = ?';
        queryParams.push(tipoCosto);
      }

      // Order by name for better UX
      query += ' ORDER BY nombre ASC';

      // Get expense categories for the business (filtered or all)
      const [categories] = await connection.query(query, queryParams);

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
          'INSERT INTO transacciones (punto_venta_id, tipo, fecha, monto_total, categoria_id, usuario_id, concepto) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            newTransaction.punto_venta_id,
            newTransaction.tipo,
            newTransaction.fecha,
            monto_total,
            newTransaction.categoria_id,
            userId,
            newTransaction.concepto,
          ],
        ); //

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

        console.log(productsId);

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
            console.log(
              'comparacion',
              monto_total,
              '---',
              newTransaction.monto_total,
            );

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
  async getTransactionsByBusiness(
    userId: string,
    businessId: number,
    fecha: string, // Formato 'YYYY-MM-DD'
  ) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      console.log('entro');

      // Verify that the business exists and belongs to the user
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

      // Get all puntos_venta for this business
      const [puntosVentaRows]: [any[], any] = await connection.query(
        'SELECT id FROM puntos_venta WHERE negocio_id = ?',
        [businessId],
      );

      if (!puntosVentaRows || puntosVentaRows.length === 0) {
        return {
          transactions: [],
          summary: {
            totalIngresos: 0,
            totalEgresos: 0,
            balance: 0,
          },
        };
      }

      const puntoVentaIds = puntosVentaRows.map((pv) => pv.id);

      console.log('puntos de venta', puntoVentaIds);
      // Create start and end of the day
      const fechaInicio = `${fecha} 00:00:00`;
      const fechaFin = `${fecha} 23:59:59`;

      console.log('Fecha inicio', fechaInicio);
      console.log('Fecha fin ', fechaFin);

      const query = `SELECT 
          t.*, 
          pv.nombre as punto_venta_nombre,
          ce.nombre as categoria_nombre
        FROM 
          transacciones t
          LEFT JOIN puntos_venta pv ON t.punto_venta_id = pv.id
          LEFT JOIN categorias_egresos ce ON t.categoria_id = ce.id
        WHERE 
          t.punto_venta_id IN (?) AND
          t.fecha BETWEEN ? AND ?
        ORDER BY t.fecha DESC`;
      // Get transactions for this business's points of sale for the specific date
      const [transactionsRows]: [any[], any] = await connection.query(query, [
        puntoVentaIds,
        fechaInicio,
        fechaFin,
      ]);
      console.log('query', query);

      console.log('respuesta trabsacciones', transactionsRows);

      // Get transaction details for income transactions
      const ingresos = transactionsRows.filter((t) => t.tipo === 'ingreso');
      if (ingresos.length > 0) {
        const ingresoIds = ingresos.map((t) => t.id);

        const [detallesRows]: [any[], any] = await connection.query(
          `SELECT 
            dt.*,
            p.nombre as producto_nombre,
            p.unidad_medida
          FROM 
            detalle_transacciones dt
            JOIN productos p ON dt.producto_id = p.id
          WHERE dt.transaccion_id IN (?)`,
          [ingresoIds],
        );

        // Group details by transaction_id
        const detallesPorTransaccion = {};
        detallesRows.forEach((detalle) => {
          if (!detallesPorTransaccion[detalle.transaccion_id]) {
            detallesPorTransaccion[detalle.transaccion_id] = [];
          }
          detallesPorTransaccion[detalle.transaccion_id].push(detalle);
        });

        // Add details to transactions
        transactionsRows.forEach((transaction) => {
          if (transaction.tipo === 'ingreso') {
            transaction.detalles = detallesPorTransaccion[transaction.id] || [];
          }
        });
      }

      // Calculate summary statistics for transactions on this date
      const totalIngresos = transactionsRows
        .filter((t) => t.tipo === 'ingreso')
        .reduce((sum, t) => sum + parseFloat(t.monto_total), 0);

      const totalEgresos = transactionsRows
        .filter((t) => t.tipo === 'egreso')
        .reduce((sum, t) => sum + parseFloat(t.monto_total), 0);

      return {
        transactions: transactionsRows,
        summary: {
          totalIngresos,
          totalEgresos,
          balance: totalIngresos - totalEgresos,
        },
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Error al obtener las transacciones del negocio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async getTransactionByDay(
    userId: string,
    businessId: number,
    fecha: string,
    tipo: string,
  ) {
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

      const [transactionData]: [any[], any] = await connection.query(
        ``
      )
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Error al ejecutar el servicio',
        error.status || 500,
      );
    } finally {
    }
  }
}
