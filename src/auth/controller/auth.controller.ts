import {
  Controller,
  Get,
  HttpException,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { AuthGuard } from '@nestjs/passport';
import { JwtauthGuard } from '../guards/JwtGuard.guard';


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req) {
    try {
      const user = req.user;

      return await this.authService.login(user, req);
    } catch (error) {
      throw new HttpException(error.message, error.status);
    }
  }

  @Get('check')
  @UseGuards(JwtauthGuard)
  checkSession(@Request() req) {
    
    return {
      status: 'success',
      message: 'Sesión activa',
      user: req.user,
    };
  }
}
