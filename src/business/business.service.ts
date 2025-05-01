import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  Pool,
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from 'mysql2/promise';
import { CreateBusinessDto } from './dto/CreateBusiness';
import { CreatePointSaleDto } from './dto/CreatePointSale.dto';

@Injectable()
export class BusinessService {
  constructor(@Inject('MYSQL') private pool: Pool) {}

  async create(userId: string, newBusiness: CreateBusinessDto) {
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

      // Insertar el nuevo negocio con RETURNING id
      const [result] = await connection.query(
        'INSERT INTO negocios (nombre, nit, direccion, telefono, email, propietario) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        [
          newBusiness.nombre,
          newBusiness.nit,
          newBusiness.direccion || null,
          newBusiness.telefono || null,
          newBusiness.email || null,
          userId,
        ],
      );

      const businessId = result[0].id;

      // Recuperar el negocio recién creado para devolverlo
      const [newBusinessRecord] = await connection.query(
        'SELECT * FROM negocios WHERE id = ?',
        [businessId],
      );

      return newBusinessRecord[0];
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

  async createPuntoVenta(userId: string, newPuntoVenta: CreatePointSaleDto) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      // Verificar que el negocio existe y pertenece al usuario
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [newPuntoVenta.negocio_id, userId],
      );

      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para administrarlo',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Insertar el nuevo punto de venta
      const [result] = await connection.query(
        'INSERT INTO puntos_venta (negocio_id, nombre, ubicacion, latitud, longitud, responsable, telefono, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
        [
          newPuntoVenta.negocio_id,
          newPuntoVenta.nombre,
          newPuntoVenta.ubicacion || null,
          newPuntoVenta.latitud || null,
          newPuntoVenta.longitud || null,
          newPuntoVenta.responsable || null,
          newPuntoVenta.telefono || null,
          newPuntoVenta.activo === undefined ? 1 : newPuntoVenta.activo,
        ],
      );

      const puntoVentaId = result[0].id;

      // Recuperar el punto de venta recién creado para devolverlo
      const [newPuntoVentaRecord] = await connection.query(
        'SELECT * FROM puntos_venta WHERE id = ?',
        [puntoVentaId],
      );

      return newPuntoVentaRecord[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al crear el punto de venta',
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

  async deletePuntoVenta(puntoVentaId: number, userId: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();
      
      // Verificar que el punto de venta existe y pertenece a un negocio del usuario
      const [puntoVentaRows]: [any[], any] = await connection.query(
        'SELECT pv.id FROM puntos_venta pv ' +
        'JOIN negocios n ON pv.negocio_id = n.id ' +
        'WHERE pv.id = ? AND n.propietario = ?',
        [puntoVentaId, userId]
      );
      
      if (!puntoVentaRows || puntoVentaRows.length === 0) {
        throw new HttpException(
          'El punto de venta no existe o no tienes permisos para eliminarlo',
          HttpStatus.NOT_FOUND
        );
      }
      
      // Eliminar el punto de venta
      await connection.query(
        'DELETE FROM puntos_venta WHERE id = ?',
        [puntoVentaId]
      );
      
      return { 
        success: true, 
        message: 'Punto de venta eliminado correctamente'
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

  async deleteBusiness(businessId: number, userId: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();
      
      // Verificar que el negocio existe y pertenece al usuario
      const [businessRows]: [any[], any] = await connection.query(
        'SELECT id FROM negocios WHERE id = ? AND propietario = ?',
        [businessId, userId]
      );
      
      if (!businessRows || businessRows.length === 0) {
        throw new HttpException(
          'El negocio no existe o no tienes permisos para eliminarlo',
          HttpStatus.NOT_FOUND
        );
      }
      
      // Comenzar una transacción
      await connection.beginTransaction();
      
      try {
        // Primero eliminar los puntos de venta asociados
        await connection.query(
          'DELETE FROM puntos_venta WHERE negocio_id = ?',
          [businessId]
        );
        
        // Luego eliminar el negocio
        await connection.query(
          'DELETE FROM negocios WHERE id = ?',
          [businessId]
        );
        
        // Confirmar la transacción
        await connection.commit();
        
      } catch (error) {
        // Si hay error, revertir los cambios
        await connection.rollback();
        throw error;
      }
      
      return { 
        success: true, 
        message: 'Negocio eliminado correctamente junto con todos sus puntos de venta'
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

}
