import { Module } from '@nestjs/common';
import { ConfigVerificationService } from './services/config-verification.service';
import { ConfigVerificationController } from './controllers/config-verification.controller';

@Module({
  providers: [ConfigVerificationService],
  controllers: [ConfigVerificationController]
})
export class FinancialAnalysisModule {}
