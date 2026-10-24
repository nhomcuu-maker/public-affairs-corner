import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as sql from 'mssql';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: sql.ConnectionPool;

  async onModuleInit(): Promise<void> {
    const mode = process.env.DB_AUTH_MODE ?? 'windows';
    const server = process.env.DB_SERVER ?? 'localhost';
    const database = process.env.DB_DATABASE ?? 'GocDanSinh';
    if (database !== 'GocDanSinh') {
      throw new Error(`This package expects DB_DATABASE=GocDanSinh, received ${database}. Check .env.`);
    }
    const encrypt = process.env.DB_ENCRYPT !== 'false';
    const trustCertificate = process.env.DB_TRUST_CERT === 'true';

    if (mode === 'windows') {
      // Native Windows trusted auth via msnodesqlv8 and installed ODBC driver.
      // msnodesqlv8 is optional and may need Windows build tools.
      let native: typeof sql;
      try {
        native = require('mssql/msnodesqlv8') as typeof sql;
      } catch {
        throw new Error('Windows auth requires msnodesqlv8. See README.md.');
      }
      // For DB_SERVER include the named instance from SSMS, e.g. localhost\\SQLEXPRESS.
      // Values are local environment configuration, not request input.
      const odbcDriver = process.env.DB_ODBC_DRIVER ?? 'ODBC Driver 17 for SQL Server';
      if (!/^ODBC Driver (17|18) for SQL Server$/.test(odbcDriver)) {
        throw new Error('DB_ODBC_DRIVER must name ODBC Driver 17 or 18 for SQL Server');
      }
      const connectionString = [
        `Driver={${odbcDriver}}`,
        `Server=${server}`,
        `Database=${database}`,
        'Trusted_Connection=Yes',
        `Encrypt=${encrypt ? 'Yes' : 'No'}`,
        `TrustServerCertificate=${trustCertificate ? 'Yes' : 'No'}`,
      ].join(';') + ';';
      this.pool = await new native.ConnectionPool({
        server, database, connectionString,
        options: { trustedConnection: true },
        pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
        connectionTimeout: 15000,
        requestTimeout: 15000,
      } as sql.config).connect();
    } else if (mode === 'sql') {
      if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error('DB_USER and DB_PASSWORD are required in SQL auth mode');
      }
      const port = Number(process.env.DB_PORT ?? 1433);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('DB_PORT is invalid');
      }
      this.pool = await new sql.ConnectionPool({
        server,
        database,
        port,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        options: { encrypt, trustServerCertificate: trustCertificate },
        pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
        connectionTimeout: 15000,
        requestTimeout: 15000,
      }).connect();
    } else {
      throw new Error('DB_AUTH_MODE must be windows or sql');
    }
    this.logger.log(`Connected to SQL Server database ${database}`);
  }

  request(): sql.Request {
    if (!this.pool?.connected) throw new Error('Database is not connected');
    return this.pool.request();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) await this.pool.close();
  }
}
