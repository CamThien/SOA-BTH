import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsModule } from './reports/reports.module.js';

function databaseName() {
  const database = process.env.DB_NAME || 'reporting_db';
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(database) || ['product_db', 'order_db', 'auth_db', 'master', 'model', 'msdb', 'tempdb'].includes(database.toLowerCase())) {
    throw new Error('Reporting must use its own database, for example reporting_db');
  }
  return database;
}

function databasePassword() {
  if (!process.env.DB_PASSWORD) throw new Error('Missing DB_PASSWORD. Configure reporting-service/.env or the DB_PASSWORD environment variable');
  return process.env.DB_PASSWORD;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mssql' as const,
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 1433),
        username: process.env.DB_USER || 'sa',
        password: databasePassword(),
        database: databaseName(),
        autoLoadEntities: true,
        synchronize: false,
        options: { encrypt: false, trustServerCertificate: true },
      }),
    }),
    ReportsModule,
  ],
})
export class AppModule {}
