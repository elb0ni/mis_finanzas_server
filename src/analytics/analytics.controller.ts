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

  //analisis por semana
  @Get('week/performance/:businessId')
  getWeeklyPerformance(
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

    const user = req.user as JwtPayload;
    return this.analyticsService.getWeeklyPerformance(
      fecha,
      businessId,
      user.sub,
    );
    //
  }

  @Get('week/bestsellers/:businessId')
  getWeekBestSellers(
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

    const user = req.user as JwtPayload;
    return this.analyticsService.getWeekBestSellers(
      fecha,
      businessId,
      user.sub,
    );
    //
  }

  @Get('week/comparison/:businessId')
  getWeeklyComparison(
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

    const user = req.user as JwtPayload;
    return this.analyticsService.getWeeklyComparison(
      fecha,
      businessId,
      user.sub,
    );
  }
}
