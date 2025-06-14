import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtauthGuard } from 'src/auth/guards/JwtGuard.guard';
import { FinancialAnalysisService } from './financial-analysis.service';
import { JwtPayload } from 'src/auth/models/token.model';
import { createFixedCost } from './dto/createFixedCost.dto';
import { UpdateFixedCostDto } from './dto/updateFixedCost.dto';

@Controller('financial-analysis')
@UseGuards(JwtauthGuard)
export class FinancialAnalysisController {
  constructor(
    private readonly financialAnalysisService: FinancialAnalysisService,
  ) {}

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

  @Get('balancepoint/:businessId')
  async getBalancePoint(
    @Req() req,
    @Param('businessId') businessId: number,
    @Query('año') año: string,
    @Query('mes') mes: string,
  ) {
    const user = req.user as JwtPayload;

    return this.financialAnalysisService.getBalancePoint(
      businessId,
      año,
      mes,
      user.sub,
    );
  }

  //costos fijos
  @Post('fixedCost')
  async createFixedCostConfiguration(
    @Req() req,
    @Body() newFixedCost: createFixedCost,
  ) {
    const user = req.user as JwtPayload;

    return this.financialAnalysisService.createFixedCostConfiguration(
      user.sub,
      newFixedCost,
    );
  }

  @Get('fixedCost/:businessId')
  async getFixedCostConfiguration(
    @Req() req,
    @Param('businessId') businessId: number,
  ) {
    const user = req.user as JwtPayload;
    return this.financialAnalysisService.getFixedCostConfiguration(
      businessId,
      user.sub,
    );
  }

  @Delete('fixedCost/:id')
  async deleteFixedCostConfiguration(
    @Req() req,
    @Param('id') fixedCostId: number,
  ) {
    const user = req.user as JwtPayload;

    return this.financialAnalysisService.deleteFixedCostConfiguration(
      fixedCostId,
      user.sub,
    );
  }

  @Put('fixedCost/:id')
  async updateFixedCostConfiguration(
    @Req() req,
    @Param('id') fixedCostId: number,
    @Body() updateFixedCostDto: UpdateFixedCostDto,
  ) {
    const user = req.user as JwtPayload;

    return this.financialAnalysisService.updateFixedCostConfiguration(
      user.sub,
      fixedCostId,
      updateFixedCostDto,
    );
  }

  @Get('prueba')
  async prueba() {
    return this.financialAnalysisService.prueba();
  }
}
