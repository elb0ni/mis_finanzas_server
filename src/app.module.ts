import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ToolsModule } from './tools/tools.module';
import config from './config';
import { ScheduleModule } from '@nestjs/schedule';
import { MainModule } from './main/main.module';

@Module({
  imports: [
    DbModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [config],
      isGlobal: true,
    }),
    AuthModule,
    ToolsModule,
    ScheduleModule.forRoot(),
    MainModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
