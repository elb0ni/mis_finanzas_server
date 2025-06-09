import { Module } from '@nestjs/common';
import { FinancialAnalysisService } from './services/financial-analysis.service';
import { FinancialAnalysisController } from './controllers/financial-analysis.controller';

@Module({
  providers: [FinancialAnalysisService],
  controllers: [FinancialAnalysisController]
})
export class FinancialAnalysisModule {}
