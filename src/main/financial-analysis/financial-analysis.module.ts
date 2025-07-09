import { Module } from '@nestjs/common';
import { FinancialAnalysisService } from './financial-analysis.service';
import { FinancialAnalysisController } from './financial-analysis.controller';
import { ToolsModule } from 'src/tools/tools.module';

@Module({
  imports: [ToolsModule],
  providers: [FinancialAnalysisService],
  controllers: [FinancialAnalysisController],
})
export class FinancialAnalysisModule {}
