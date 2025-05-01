import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Pool, PoolConnection } from 'mysql2/promise';
import { JwtPayload } from '../models/token.model';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @Inject('MYSQL') private pool: Pool,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.userService.getUserByEmail(email);
    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, request?: any) {
    let connection: PoolConnection | null = null;
    try {
      connection = await this.pool.getConnection();
  
      // Si tenemos el objeto request disponible, obtenemos info de sesión
      let ip_address = '0.0.0.0';
      let user_agent = 'unknown';
  
      if (request) {
        ip_address =
          request.headers['x-forwarded-for'] ||
          request.connection?.remoteAddress ||
          '0.0.0.0';
        user_agent = request.headers['user-agent'] || 'unknown';
      }
  
      // Calcular fecha de expiración (1 mes)
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
  
      // Primero, insertar la sesión y obtener el ID generado
      const [result] = await connection.query(
        `INSERT INTO sessions 
          (user_id, ip_address, user_agent, expires_at) 
         VALUES (?, ?, ?, ?)
         RETURNING session_id`,
        [user.id, ip_address, user_agent, expiresAt],
      );
  
      // Extraer el session_id del resultado
      const sessionId = result[0].session_id;
    
  
      // Crear el JWT token con el sessionId incluido
      const payload: JwtPayload = {
        sub: user.id,
        role: user.role,
        sessionId: sessionId, 
      };
      const token = this.jwtService.sign(payload);
  
  
      await connection.query(
        `UPDATE sessions SET payload = ? WHERE session_id = ?`,
        [JSON.stringify({ token }), sessionId],
      );
  
      return {
        access_token: token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error en el proceso de login',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      if (connection) connection.release();
    }
  }
}
