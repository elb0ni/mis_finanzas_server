import { Global, Module } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { ConfigType } from '@nestjs/config';
import config from 'src/config';

@Global()
@Module({
  providers: [
    {
      provide: "MYSQL",
      useFactory: (configService: ConfigType<typeof config>) => {
        const { host, port, username, password, database } = 
          configService.database;
        
        // DEBUG: Verificar que las variables están llegando
        console.log('DB Config:', {
          host,
          port,
          username,
          database: database ? '***SET***' : 'UNDEFINED',
          password: password ? '***SET***' : 'UNDEFINED'
        });
        
        if (!database) {
          throw new Error('Database name is not defined in environment variables');
        }
        
        const pool = mysql.createPool({
          host,
          user: username,
          password,
          database,
          port: port ? parseInt(port) : 3306,
          waitForConnections: true,
          connectionLimit: 20,
          queueLimit: 0,
          namedPlaceholders: true,
          connectTimeout: 2000,
        });
        
        return pool;
      },
      inject: [config.KEY],
    },
    {
      provide: "MYSQL_CLIENTS",
      useFactory: (configService: ConfigType<typeof config>) => {
        const { host, port, username, password, database } = 
          configService.databaseClient;
        
        // DEBUG: Verificar configuración de clientes
        console.log('Clients DB Config:', {
          host,
          port,
          username,
          database: database ? '***SET***' : 'UNDEFINED',
          password: password ? '***SET***' : 'UNDEFINED'
        });
        
        if (!database) {
          throw new Error('Clients database name is not defined in environment variables');
        }
        
        const pool = mysql.createPool({
          host,
          user: username,
          password,
          database,
          port: port ? parseInt(port) : 3306,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          namedPlaceholders: true,
          connectTimeout: 2000,
        });
        
        return pool;
      },
      inject: [config.KEY],
    }
  ],
  exports: ["MYSQL", "MYSQL_CLIENTS"]
})
export class DbModule {}