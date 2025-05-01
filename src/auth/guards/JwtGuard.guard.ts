import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorator/public.decorator';

@Injectable()
export class JwtauthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  // Sobreescribe handleRequest para capturar errores
/*   handleRequest(err: any, user: any, info: any, context: any, status: any) {
    console.log('🔍 JwtauthGuard.handleRequest');
    console.log('❌ Error:', err ? JSON.stringify(err) : 'No hay error');
    console.log('👤 Usuario:', user ? 'Encontrado' : 'No encontrado');
    console.log('ℹ️ Info:', info ? JSON.stringify(info) : 'No hay info');

    // Si hay un error o no hay usuario autenticado
    if (err || !user) {
      // Proporcionar mensaje más específico según el tipo de error
      if (info && info.name === 'JsonWebTokenError') {
        throw new UnauthorizedException(`Error de token: ${info.message}`);
      } else if (info && info.name === 'TokenExpiredError') {
        throw new UnauthorizedException('El token ha expirado');
      } else {
        throw err || new UnauthorizedException('No se pudo autenticar');
      }
    }

    return user;
  } */

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }
    
    return super.canActivate(context);
  }
}