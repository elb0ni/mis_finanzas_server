import { Global, Module } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { ConfigType } from '@nestjs/config';
import config from 'src/config';

@Global()
@Module({
    providers:[{
        provide: "MYSQL",
        useFactory: (configService: ConfigType<typeof config>) => {
          const { host, port, username, password, database } = 
            configService.database;
          
          const pool = mysql.createPool({
            host,
            user: username,
            password,
            database,
            port: port ? parseInt(port) : 3306, //,
            waitForConnections: true,
            connectionLimit: 20, // Máximo de conexiones en el pool (ajústalo según tu carga)
            queueLimit: 0, // Sin límite en la cola de conexiones pendientes
            namedPlaceholders: true, // Permite usar placeholders con nombre
            connectTimeout: 2000, // Equivalente a connectionTimeoutMillis
          });
          
          return pool;
        },
        inject: [config.KEY],
      }],
      exports: ["MYSQL"]
})
export class DbModule {}
