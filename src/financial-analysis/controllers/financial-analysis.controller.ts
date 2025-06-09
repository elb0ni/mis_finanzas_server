import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtauthGuard } from 'src/auth/guards/JwtGuard.guard';
import { FinancialAnalysisService } from '../services/financial-analysis.service';
import { JwtPayload } from 'src/auth/models/token.model';
import { QuickConfirmationDto } from '../dto/quick-confirmation.dto';

@Controller('financial-analysis')
@UseGuards(JwtauthGuard)
export class FinancialAnalysisController {
  constructor(
    private readonly financialAnalysisService: FinancialAnalysisService,
  ) {}

  @Get('prueba')
  async prueba() {
    return this.financialAnalysisService.prueba();
  }

  @Get(':businessId')
  async verifyCurrentMonthConfig(
    @Req() req,
    @Param('businessId') businessId: number,
    @Body('pointOfSaleId') pointOfSaleId?: number,
  ) {
    const user = req.user as JwtPayload;

    return this.financialAnalysisService.verifyCurrentMonthConfig(
      user.sub,
      businessId,
      pointOfSaleId,
    );
  }

  @Post('quick-confirm')
  async quickConfirmCurrentConfig(
    @Req() req,
    @Body() data: QuickConfirmationDto,
  ) {
    return this.financialAnalysisService.quickConfirmCurrentConfig(
      req.user.userId,
      data,
    );
  }

  @Get('summaryDay/:businessId')
  async getSummaryDay(
    @Req() req,
    @Param('businessId') businessId: number,
    @Query('fecha') fecha: string,
  ) {
    console.log(fecha);

    const user = req.user as JwtPayload;

    return this.financialAnalysisService.getSummaryDay(
      user.sub,
      businessId,
      fecha,
    );
  }

  @Get('productprofit/:businessId')
  async getProductProfitSummary(
    @Req() req,
    @Param('businessId') businessId: number,
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
  ) {
    const user = req.user as JwtPayload;

    return this.financialAnalysisService.getProductProfitSummary(
      user.sub,
      businessId,
      fechaInicio,
      fechaFin,
    );
  }
}
