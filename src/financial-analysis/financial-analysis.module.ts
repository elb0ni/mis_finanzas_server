import { Module } from '@nestjs/common';
import { FinancialAnalysisService } from './financial-analysis.service';
import { FinancialAnalysisController } from './financial-analysis.controller';

@Module({
  providers: [FinancialAnalysisService],
  controllers: [FinancialAnalysisController]
})
export class FinancialAnalysisModule {}
