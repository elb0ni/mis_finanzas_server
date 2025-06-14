import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ToolsModule } from './tools/tools.module';
import { ProductsModule } from './products/products.module';
import { FinancialAnalysisModule } from './financial-analysis/financial-analysis.module';
import config from './config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    DbModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [config],
      isGlobal: true,
    }),
    UserModule,
    AuthModule,
    BusinessModule,
    TransactionsModule,
    ToolsModule,
    ProductsModule,
    FinancialAnalysisModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
