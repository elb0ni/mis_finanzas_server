import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  Pool,
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from 'mysql2/promise';
import CreatePuntoVentaDto from './dto/CreatePointSale.dto';
import CreateBusinessDto from './dto/CreateBusiness';
import {
  UpdatePuntoVentaDto,
  UpdatePuntoVentaStatusDto,
} from './dto/UpdatePuntoVentaDto';

@Injectable()
export class BusinessService {
  constructor(@Inject('MYSQL') private pool: Pool) {}

  //BUSINESS

  async create(userId: string, newBusiness: CreateBusinessDto) {
    let connection: PoolConnection | null = null;
    try {
      // Obtener conexión a la base de datos
      connection = await this.pool.getConnection();

      // Verificar que el usuario existe
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

      // Insertar el nuevo negocio
      const [result]: [any, any] = await connection.query(
        'INSERT INTO negocios (nombre, nit, direccion, telefono, email, propietario) VALUES (?, ?, ?, ?, ?, ?)',
        [
          newBusiness.nombre,
          newBusiness.nit,
          newBusiness.direccion || null,
          newBusiness.telefono || null,
          newBusiness.email || null,
          userId,
        ],
      );

      // Obtener el negocio recién creado para devolverlo
      const [createdBusiness] = await connection.query(
        'SELECT * FROM negocios WHERE id = ?',
        [result.insertId],
      );

      return createdBusiness[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear el negocio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async findByUser(userId: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verificar que el usuario existe
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

      // Obtener todos los negocios del usuario
      const [businesses] = await connection.query(
        'SELECT * FROM negocios WHERE propietario = ?',
        [userId],
      );

      return businesses;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener los negocios del usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async deleteBusiness(businessId: number, userId: string) {
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
          'El negocio no existe o no tienes permisos para eliminarlo',
          HttpStatus.NOT_FOUND,
        );
      }

      // Comenzar una transacción
      await connection.beginTransaction();

      try {
        // Primero eliminar los puntos de venta asociados
        await connection.query(
          'DELETE FROM puntos_venta WHERE negocio_id = ?',
          [businessId],
        );

        // Luego eliminar el negocio
        await connection.query('DELETE FROM negocios WHERE id = ?', [
          businessId,
        ]);

        // Confirmar la transacción
        await connection.commit();
      } catch (error) {
        // Si hay error, revertir los cambios
        await connection.rollback();
        throw error;
      }

      return {
        success: true,
        message:
          'Negocio eliminado correctamente junto con todos sus puntos de venta',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al eliminar el negocio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  //POINT OF SALE

  async createPuntoVenta(userId: string, newPuntoVenta: CreatePuntoVentaDto) {
    console.log(newPuntoVenta);

    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();
      console.log('ANTES');
      // Verificar que el usuario existe
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
        [newPuntoVenta.negocio_id, userId],
      );
      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio especificado no existe o no pertenece al usuario',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Verificar que el departamento existe
      const [deptoRows]: [any[], any] = await connection.query(
        'SELECT id_departamento FROM departamentos WHERE id_departamento = ?',
        [newPuntoVenta.departamento],
      );
      if (!deptoRows || deptoRows.length === 0) {
        throw new HttpException(
          'El departamento especificado no existe',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Verificar que el municipio existe y pertenece al departamento
      const [muniRows]: [any[], any] = await connection.query(
        'SELECT id_municipio FROM municipios WHERE id_municipio = ? AND departamento_id = ?',
        [newPuntoVenta.municipio, newPuntoVenta.departamento],
      );
      if (!muniRows || muniRows.length === 0) {
        throw new HttpException(
          'El municipio especificado no existe o no pertenece al departamento indicado',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Usar RETURNING * para obtener todos los campos de la fila insertada
      const [result] = await connection.query(
        'INSERT INTO puntos_venta (negocio_id, nombre, ubicacion, latitud, longitud, responsable, telefono, activo, nota, departamento, municipio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
        [
          newPuntoVenta.negocio_id,
          newPuntoVenta.nombre,
          newPuntoVenta.ubicacion,
          newPuntoVenta.latitud || null,
          newPuntoVenta.longitud || null,
          newPuntoVenta.responsable || null,
          newPuntoVenta.telefono || null,
          newPuntoVenta.activo !== undefined ? newPuntoVenta.activo : 1,
          newPuntoVenta.nota || null,
          newPuntoVenta.departamento,
          newPuntoVenta.municipio,
        ],
      );

      console.log('DESPUES');
      // El resultado ahora contiene directamente la fila insertada
      return result[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear el punto de venta',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async updatePuntoVenta(
    userId: string,
    puntoVentaId: number,
    updatePuntoVentaDto: UpdatePuntoVentaDto,
  ) {
    console.log(updatePuntoVentaDto);

    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verificar que el punto de venta existe
      const [puntoVentaRows]: [any[], any] = await connection.query(
        'SELECT * FROM puntos_venta WHERE id = ?',
        [puntoVentaId],
      );
      if (!puntoVentaRows || puntoVentaRows.length === 0) {
        throw new HttpException(
          'El punto de venta especificado no existe',
          HttpStatus.NOT_FOUND,
        );
      }

      const puntoVenta = puntoVentaRows[0];

      // Verificar que el usuario existe
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
        [puntoVenta.negocio_id, userId],
      );
      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio al que pertenece este punto de venta no existe o no pertenece al usuario',
          HttpStatus.FORBIDDEN,
        );
      }

      // Verificar el departamento si está siendo actualizado
      if (updatePuntoVentaDto.departamento) {
        const [deptoRows]: [any[], any] = await connection.query(
          'SELECT id_departamento FROM departamentos WHERE id_departamento = ?',
          [updatePuntoVentaDto.departamento],
        );
        if (!deptoRows || deptoRows.length === 0) {
          throw new HttpException(
            'El departamento especificado no existe',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Verificar el municipio si está siendo actualizado
      if (updatePuntoVentaDto.municipio) {
        const departamentoId =
          updatePuntoVentaDto.departamento || puntoVenta.departamento;
        const [muniRows]: [any[], any] = await connection.query(
          'SELECT id_municipio FROM municipios WHERE id_municipio = ? AND departamento_id = ?',
          [updatePuntoVentaDto.municipio, departamentoId],
        );
        if (!muniRows || muniRows.length === 0) {
          throw new HttpException(
            'El municipio especificado no existe o no pertenece al departamento indicado',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Construir la query de actualización dinámicamente
      const updateFields: any = [];
      const updateValues: any = [];

      // Mapeo de campos a actualizar (excluyendo latitud y longitud)
      const fieldsToUpdate = [
        'negocio_id',
        'nombre',
        'ubicacion',
        // 'latitud',  // Removidos como solicitado
        // 'longitud', // Removidos como solicitado
        'responsable',
        'telefono',
        'activo',
        'nota',
        'departamento',
        'municipio',
      ];

      // Construir la lista de campos a actualizar
      fieldsToUpdate.forEach((field) => {
        if (updatePuntoVentaDto[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          // Para los campos que pueden ser null
          if (
            field === 'responsable' ||
            field === 'telefono' ||
            field === 'nota'
          ) {
            updateValues.push(updatePuntoVentaDto[field] || null);
          } else {
            updateValues.push(updatePuntoVentaDto[field]);
          }
        }
      });

      // Añadir timestamp de actualización
      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      // Si no hay campos para actualizar, retornar el punto de venta sin cambios
      if (updateFields.length === 0) {
        return puntoVenta;
      }

      // Añadir el ID del punto de venta a los valores
      updateValues.push(puntoVentaId);

      // Ejecutar la query de actualización
      await connection.query(
        `UPDATE puntos_venta SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
      );

      // Fetch the updated record with a separate query
      const [updatedRecord] = await connection.query(
        'SELECT * FROM puntos_venta WHERE id = ?',
        [puntoVentaId],
      );

      // Return the updated record
      return updatedRecord[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar el punto de venta',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async updatePuntoVentaStatus(
    userId: string,
    puntoVentaId: number,
    activo: UpdatePuntoVentaStatusDto,
  ) {
    let connection: PoolConnection | null = null;

    try {
      console.log(activo);
      
      connection = await this.pool.getConnection();
  
      // Verificar que el punto de venta existe
      const [puntoVentaRows]: [any[], any] = await connection.query(
        'SELECT * FROM puntos_venta WHERE id = ?',
        [puntoVentaId],
      );
      if (!puntoVentaRows || puntoVentaRows.length === 0) {
        throw new HttpException(
          'El punto de venta especificado no existe',
          HttpStatus.NOT_FOUND,
        );
      }
  
      const puntoVenta = puntoVentaRows[0];
  
      // Verificar que el usuario existe
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
        [puntoVenta.negocio_id, userId],
      );
      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio al que pertenece este punto de venta no existe o no pertenece al usuario',
          HttpStatus.FORBIDDEN,
        );
      }
  
      // Actualizar solo el campo 'activo' y el timestamp
      // Convertir el booleano a tinyint (0 o 1)
      const activoValue = activo.activo ? 1 : 0;
      console.log(activoValue);
      
      await connection.query(
        'UPDATE puntos_venta SET activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [activoValue, puntoVentaId],
      );
  
      // Obtener el registro actualizado
      const [updatedRecord] = await connection.query(
        'SELECT * FROM puntos_venta WHERE id = ?',
        [puntoVentaId],
      );
  
      // Convertir el campo activo a booleano para la respuesta
      const updatedPuntoVenta = {
        ...updatedRecord[0],
        activo: updatedRecord[0].activo === 1, // Convertir de 0/1 a false/true
        mensaje: `El punto de venta ha sido ${activo ? 'activado' : 'desactivado'} correctamente`,
      };
      
      return updatedPuntoVenta;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar el estado del punto de venta',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  // Método para obtener puntos de venta de un negocio
  async findPuntosVentaByNegocio(negocioId: number, userId: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verificar que el negocio existe y pertenece al usuario
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [negocioId, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Obtener todos los puntos de venta del negocio
      const [puntosVenta] = await connection.query(
        'SELECT * FROM puntos_venta WHERE negocio_id = ?',
        [negocioId],
      );

      return puntosVenta;
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener los puntos de venta',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async findPuntoVentaById(
    negocioId: number,
    puntoVentaId: number,
    userId: string,
  ) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verificar que el negocio existe y pertenece al usuario
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [negocioId, userId],
      );
      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para acceder',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Obtener el punto de venta específico
      const [puntosVenta]: any = await connection.query(
        'SELECT pv.* FROM puntos_venta pv ' +
          'LEFT JOIN departamentos d ON pv.departamento = d.id_departamento ' +
          'LEFT JOIN municipios m ON pv.municipio = m.id_municipio ' +
          'WHERE pv.negocio_id = ? AND pv.id = ?',
        [negocioId, puntoVentaId],
      );

      if (!puntosVenta || puntosVenta.length === 0) {
        throw new HttpException(
          'El punto de venta no existe o no pertenece al negocio especificado',
          HttpStatus.NOT_FOUND,
        );
      }

      return puntosVenta[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener la información del punto de venta',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async deletePuntoVenta(puntoVentaId: number, userId: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verificar que el punto de venta existe y pertenece a un negocio del usuario
      const [puntoVentaRows]: [any[], any] = await connection.query(
        'SELECT pv.id FROM puntos_venta pv ' +
          'JOIN negocios n ON pv.negocio_id = n.id ' +
          'WHERE pv.id = ? AND n.propietario = ?',
        [puntoVentaId, userId],
      );

      if (!puntoVentaRows || puntoVentaRows.length === 0) {
        throw new HttpException(
          'El punto de venta no existe o no tienes permisos para eliminarlo',
          HttpStatus.NOT_FOUND,
        );
      }

      // Eliminar el punto de venta
      await connection.query('DELETE FROM puntos_venta WHERE id = ?', [
        puntoVentaId,
      ]);

      return {
        success: true,
        message: 'Punto de venta eliminado correctamente',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al eliminar el punto de venta',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }
}
