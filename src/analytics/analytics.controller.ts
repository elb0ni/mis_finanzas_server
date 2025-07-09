import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtPayload } from 'src/auth/models/token.model';
import { JwtauthGuard } from 'src/auth/guards/JwtGuard.guard';

@Controller('analytics')
@UseGuards(JwtauthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}
  //ANALISI POR DIA

  @Get('day/:businessId')
  getDayAnalisis(
    @Param('businessId') businessId: number,
    @Req() req,
    @Query('fecha') fecha: string,
  ) {
    if (!fecha) {
      throw new HttpException(
        'Debes seleccionar una fecha para hacer la peticion',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!businessId) {
      throw new HttpException(
        'Debes seleccionar un negocio para hacer la peticion',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validar formato de fecha YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fecha)) {
      throw new HttpException(
        'La fecha debe estar en formato YYYY-MM-DD',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = req.user as JwtPayload;
    return this.analyticsService.getDayAnalisis(fecha, businessId, user.sub);
  }

  //ANALISIS POR SEMANA

  @Get('week/:businessId')
  getWeekAnalisis(
    @Param('businessId') businessId: number,
    @Query('fecha') fecha: string,
    @Req() req,
  ) {
    const user = req.user as JwtPayload;

    if (!fecha) {
      throw new HttpException(
        'Debes seleccionar una fecha para hacer la peticion',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!businessId) {
      throw new HttpException(
        'Debes seleccionar un negocio para hacer la peticion',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.analyticsService.getWeekAnalisis(fecha, businessId, user.sub);
  }

  //ANALISIS PARA MES

  @Get('month/:businessId')
  getMonthAnalisis(
    @Param('businessId') businessId: number,
    @Query('fecha') fecha: string,
    @Req() req,
  ) {
    const user = req.user as JwtPayload;

    if (!fecha) {
      throw new HttpException(
        'Debes seleccionar una fecha para hacer la peticion',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!businessId) {
      throw new HttpException(
        'Debes seleccionar un negocio para hacer la peticion',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.analyticsService.getMonthAnalisis(fecha, businessId, user.sub);
  }


  
}
