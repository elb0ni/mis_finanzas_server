import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { UserService } from './user.service';
import CreateUserDto from './dto/CreateUserDto';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) { }

  @Post()
  async register(@Body() newUser: CreateUserDto) {
    try {
      return this.userService.create(newUser);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al registrar el usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


}
