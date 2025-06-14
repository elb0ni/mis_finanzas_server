import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Pool, PoolConnection } from 'mysql2/promise';
import CreateProductDto from './dto/CreateProductDto';
import UpdateProductDto from './dto/UpdateProductDto ';

@Injectable()
export class ProductsService {
  constructor(@Inject('MYSQL') private pool: Pool) {}

  async createProduct(userId: string, newProduct: CreateProductDto) {
    console.log(newProduct);

    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      const [userRows]: [any[], any] = await connection.query(
        'SELECT id FROM users WHERE id = ?',
        [userId],
      );
      if (!userRows || userRows.length === 0) {
        throw new HttpException(
          'El usuario especificado no existe',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Verificar que el negocio existe y pertenece al usuario
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [newProduct.negocio_id, userId],
      );
      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio especificado no existe o no pertenece al usuario',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Realizar la inserción estándar en MySQL (sin RETURNING *)
      const [insertResult]: any = await connection.query(
        'INSERT INTO productos (negocio_id, nombre, descripcion, unidad_medida, precio_unitario, costo_unitario, codigo_interno, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          newProduct.negocio_id,
          newProduct.nombre,
          newProduct.descripcion || null,
          newProduct.unidad_medida || 'unidad',
          newProduct.precio_unitario,
          newProduct.costo_unitario,
          newProduct.codigo_interno || null,
          newProduct.activo !== undefined ? newProduct.activo : true,
        ],
      );

      // Obtener el ID insertado
      const insertId = insertResult.insertId;

      // Consultar el producto recién insertado
      const [productRows] = await connection.query(
        'SELECT * FROM productos WHERE id = ?',
        [insertId],
      );

      return productRows[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear el producto',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async updateProduct(
    userId: string,
    productId: number,
    updateProductDto: UpdateProductDto,
  ) {
    console.log(updateProductDto);

    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verificar que el producto existe
      const [productRows]: [any[], any] = await connection.query(
        'SELECT p.*, n.propietario FROM productos p JOIN negocios n ON p.negocio_id = n.id WHERE p.id = ?',
        [productId],
      );

      if (!productRows || productRows.length === 0) {
        throw new HttpException(
          'El producto especificado no existe',
          HttpStatus.NOT_FOUND,
        );
      }

      const producto = productRows[0];

      // Verificar que el negocio del producto pertenece al usuario
      if (producto.propietario !== userId) {
        throw new HttpException(
          'No tienes permisos para actualizar este producto',
          HttpStatus.FORBIDDEN,
        );
      }

      // Verificar el negocio si está siendo actualizado
      if (updateProductDto.negocio_id) {
        const [businessRows]: [any[], any] = await connection.query(
          'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
          [updateProductDto.negocio_id, userId],
        );
        if (!businessRows || businessRows.length === 0) {
          throw new HttpException(
            'El negocio especificado no existe o no pertenece al usuario',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Construir la query de actualización dinámicamente
      const updateFields: any = [];
      const updateValues: any = [];

      // Mapeo de campos a actualizar
      const fieldsToUpdate = [
        'negocio_id',
        'nombre',
        'descripcion',
        'unidad_medida',
        'precio_unitario',
        'costo_unitario',
        'codigo_interno',
        'activo',
      ];

      // Construir la lista de campos a actualizar
      fieldsToUpdate.forEach((field) => {
        if (updateProductDto[field] !== undefined) {
          updateFields.push(`${field} = ?`);

          // Para los campos que pueden ser null
          if (
            field === 'descripcion' ||
            field === 'codigo_interno' ||
            field === 'unidad_medida'
          ) {
            updateValues.push(updateProductDto[field] || null);
          } else {
            updateValues.push(updateProductDto[field]);
          }
        }
      });

      // Añadir timestamp de actualización
      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      // Si no hay campos para actualizar, retornar el producto sin cambios
      if (updateFields.length === 0) {
        return producto;
      }

      // Añadir el ID del producto a los valores
      updateValues.push(productId);

      // Ejecutar la query de actualización (sin RETURNING *)
      await connection.query(
        `UPDATE productos SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
      );

      // Obtener el registro actualizado con una consulta separada
      const [updatedRecord] = await connection.query(
        'SELECT * FROM productos WHERE id = ?',
        [productId],
      );

      // Retornar el registro actualizado
      return updatedRecord[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar el producto',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async findProductsByBusiness(businessId: number, userId: string) {
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
          'El negocio no existe o no tienes permisos para acceder',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Obtener todos los productos del negocio
      const [productos] = await connection.query(
        'SELECT * FROM productos WHERE negocio_id = ?',
        [businessId],
      );

      return productos;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener los productos',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async findProductById(businessId: number, productId: number, userId: string) {
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
          'El negocio no existe o no tienes permisos para acceder',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Obtener el producto específico
      const [productos]: any = await connection.query(
        'SELECT * FROM productos WHERE negocio_id = ? AND id = ?',
        [businessId, productId],
      );

      if (!productos || productos.length === 0) {
        throw new HttpException(
          'El producto no existe o no pertenece al negocio especificado',
          HttpStatus.NOT_FOUND,
        );
      }

      return productos[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener la información del producto',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async deleteProduct(productId: number, userId: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verificar que el producto existe y pertenece a un negocio del usuario
      const [productRows]: [any[], any] = await connection.query(
        'SELECT p.id FROM productos p ' +
          'JOIN negocios n ON p.negocio_id = n.id ' +
          'WHERE p.id = ? AND n.propietario = ?',
        [productId, userId],
      );

      if (!productRows || productRows.length === 0) {
        throw new HttpException(
          'El producto no existe o no tienes permisos para eliminarlo',
          HttpStatus.NOT_FOUND,
        );
      }

      // Eliminar el producto
      await connection.query('DELETE FROM productos WHERE id = ?', [productId]);

      return {
        success: true,
        message: 'Producto eliminado correctamente',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al eliminar el producto',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }
}
