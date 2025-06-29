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

        if (!database) {
          throw new Error('Database name is not defined in environment variables');
        }

        const pool = mysql.createPool({
          host,
          user: username,
          password,
          database,
          port: port ? parseInt(port) : 3306,
          connectionLimit: 100, 
          waitForConnections: true,
          idleTimeout: 300000, 
          namedPlaceholders: true,
          multipleStatements: false, 
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


        if (!database) {
          throw new Error('Clients database name is not defined in environment variables');
        }

        const pool = mysql.createPool({
          host,
          user: username,
          password,
          database,
          port: port ? parseInt(port) : 3306,
          connectionLimit: 100, 
          waitForConnections: true,
          idleTimeout: 300000, 
          namedPlaceholders: true,
          multipleStatements: false, 
        });

        return pool;
      },
      inject: [config.KEY],
    }
  ],
  exports: ["MYSQL", "MYSQL_CLIENTS"]
})
export class DbModule { }