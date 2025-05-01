import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { JwtPayload } from '../models/token.model';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject('MYSQL') private pool: Pool) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return ExtractJwt.fromAuthHeaderAsBearerToken()(request);
        },
        (request: Request) => {
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: true,
      secretOrKey: process.env.JWT_KEY || 'JeMa1>PyJ/BBp8S@)M782?O',

    });
  }

  async validate(payload: JwtPayload) {
    try {
      
      const [sessions] = await this.pool.query<RowDataPacket[]>(
        `SELECT session_id, expires_at, is_active 
         FROM sessions 
         WHERE session_id = ? AND user_id = ? AND is_active = 1`,
        [payload.sessionId, payload.sub],
      );

      if (!sessions || sessions.length === 0) {
        throw new UnauthorizedException('Sesión no válida');
      }

      const session = sessions[0];

      // Verificar si la sesión ha expirado
      const expiresAt = new Date(session.expires_at);
      const now = new Date();

      if (expiresAt < now) {
        // La sesión ha expirado, marcarla como inactiva en la base de datos
        await this.pool.query(
          'UPDATE sessions SET is_active = 0 WHERE session_id = ?',
          [payload.sessionId],
        );

        throw new UnauthorizedException('Sesión expirada');
      }

      return payload;
    } catch (error) {
      // Si es un UnauthorizedException, reenviar el error
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Para cualquier otro error, lanzar un UnauthorizedException genérico
      throw new UnauthorizedException('Error al validar la sesión');
    }
  }
}