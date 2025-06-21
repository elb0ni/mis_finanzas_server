import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ToolsService } from './tools.service';

@Controller('tools')
export class ToolsController {
  constructor(private toolsService: ToolsService) {}

  @Get('departments')
  async getDepartments() {
    try {
      return this.toolsService.getDepartments();
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al registrar el usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  @Get('municipalities/:id')
  async Municipalities(@Param('id') departmentId: string) {
    try {
      return this.toolsService.getMunicipalities(+departmentId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al registrar el usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('fixedcostshis/:negocioId')
  async generarCostosFijosManual(
    @Param('negocioId') negocioId: number,
    @Query('año') año?: number,
    @Query('mes') mes?: number,
  ) {
    return this.toolsService.generateFixedCosts(negocioId, año, mes);
  }
}
