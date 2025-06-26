import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolConnection } from 'mysql2/promise';

@Injectable()
export class AnalyticsService {
      constructor(
        @Inject('MYSQL') private pool: Pool,
        @Inject('MYSQL_CLIENTS') private poolClient: Pool,
      ) {}
}
