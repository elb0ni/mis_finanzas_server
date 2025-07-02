import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
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
import { ToolsService } from 'src/tools/tools.service';

@Controller('financial-analysis')
@UseGuards(JwtauthGuard)
export class FinancialAnalysisController {
  constructor(
    private readonly financialAnalysisService: FinancialAnalysisService,
    private readonly toolsService: ToolsService,
  ) {}

  @Get('summaryDay/:businessId')
  async getSummaryDay(
    @Req() req,
    @Param('businessId') businessId: number,
    @Query('fecha') fecha: string,
  ) {
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
    @Query('autoGenerate') autoGenerate: string,
  ) {
    try {
      const user = req.user as JwtPayload;
      const autoGenerateCosts = autoGenerate === 'true';

      const result = await this.financialAnalysisService.getBalancePoint(
        businessId,
        año,
        mes,
        user.sub,
        autoGenerateCosts,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error.message === 'MISSING_FIXED_COSTS_CONFIG') {
        throw new HttpException(
          {
            success: false,
            error: 'MISSING_FIXED_COSTS_CONFIG',
            message: 'Se requiere configuración de costos fijos',
            action: 'SHOW_GENERATION_MODAL',
          },
          HttpStatus.PRECONDITION_REQUIRED,
        );
      }

      if (error.message === 'MISSING_MONTHLY_COSTS') {
        throw new HttpException(
          {
            success: false,
            error: 'MISSING_MONTHLY_COSTS',
            message: 'Se requiere generar costos mensuales',
            action: 'SHOW_GENERATION_MODAL',
          },
          HttpStatus.PRECONDITION_REQUIRED,
        );
      }

      throw new HttpException(
        {
          success: false,
          error: 'BALANCE_POINT_ERROR',
          message: error.message || 'Error al calcular el punto de equilibrio',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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

  @Post('fixedcostshis/:negocioId')
  async generateFixedCosts(
    @Param('negocioId') negocioId: number,
    @Query('año') año?: number,
    @Query('mes') mes?: number,
  ) {
    return this.toolsService.generateFixedCosts(negocioId, año, mes);
  }
  
  @Get('fixedcostshis/:negocioId')
  async getGenerateFixedCosts(
    @Param('negocioId') negocioId: number,
    @Req() req,
  ) {
    const user = req.user as JwtPayload;

    return this.toolsService.getFixedCostsHistory(negocioId, user.sub);
  }
}
