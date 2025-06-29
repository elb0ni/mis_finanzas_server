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
  constructor(private analyticsService: AnalyticsService) { }
  //ANALISI POR DIA

  @Get('daily/bestsellers/:businessId')
  getDailyBestSellers(
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
    return this.analyticsService.getDailyBestSellers(
      fecha,
      businessId,
      user.sub,
    );
  }

  @Get('daily/performance/:businessId')
  getDailyPerformance(
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
    return this.analyticsService.getDailyPerformance(
      fecha,
      businessId,
      user.sub,
    );
  }

  //ANALISIS POR SEMAN
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


  }
  //ANALISIS POR ME

  @Get('month/performance/:businessId')
  getMonthPerformance(
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
    return this.analyticsService.getMonthPerformance(
      fecha,
      businessId,
      user.sub,
    );
  }

  @Get('month/bestsellers/:businessId')
  getMonthBestSellers(
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
    return this.analyticsService.getMonthBestSellers(
      fecha,
      businessId,
      user.sub,
    );

    //
  }

}
