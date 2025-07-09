import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  Pool,
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from 'mysql2/promise';
import CreateUserDto from './dto/CreateUserDto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(@Inject('MYSQL') private pool: Pool) {}

  async getUserByEmail(email: string) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      const [rows] = await connection.query(
        'SELECT * FROM users WHERE email = ?',
        [email],
      );
      
      const users = rows as any[];

      if (users.length === 0) {
        throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
      }

      return users[0];
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener usuarios',
        error.status,
      );
    } finally {
      if (connection) connection.release();
    }
  }

  async create(newUser: CreateUserDto) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();

      const hashedPassword = await bcrypt.hash(newUser.password, 10);

      const [result] = await connection.execute(
        `INSERT INTO users (email, password)
         VALUES (?, ?)
         RETURNING id`,
        [newUser.email, hashedPassword],
      );

      const userId = result[0].id;

      return {
        success: true,
        message: 'Usuario registrado exitosamente',
        userId: userId,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al registrar el usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }

}
