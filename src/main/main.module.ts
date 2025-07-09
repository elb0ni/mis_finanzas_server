import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { BusinessModule } from './business/business.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UserModule } from './user/user.module';
import { ProductsModule } from './products/products.module';
import { FinancialAnalysisModule } from './financial-analysis/financial-analysis.module';

@Module({
    imports: [
        AnalyticsModule,
        BusinessModule,
        TransactionsModule,
        UserModule,
        ProductsModule,
        FinancialAnalysisModule
    ],
    exports: [
        AnalyticsModule,
        BusinessModule,
        TransactionsModule,
        UserModule,
        ProductsModule,
        FinancialAnalysisModule
    ]
})
export class MainModule { }
