"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var DatabaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const sql = __importStar(require("mssql"));
let DatabaseService = DatabaseService_1 = class DatabaseService {
    logger = new common_1.Logger(DatabaseService_1.name);
    pool;
    async onModuleInit() {
        const mode = process.env.DB_AUTH_MODE ?? 'windows';
        const server = process.env.DB_SERVER ?? 'localhost';
        const database = process.env.DB_DATABASE ?? 'GocDanSinh';
        if (database !== 'GocDanSinh') {
            throw new Error(`This package expects DB_DATABASE=GocDanSinh, received ${database}. Check .env.`);
        }
        const encrypt = process.env.DB_ENCRYPT !== 'false';
        const trustCertificate = process.env.DB_TRUST_CERT === 'true';
        if (mode === 'windows') {
            let native;
            try {
                native = require('mssql/msnodesqlv8');
            }
            catch {
                throw new Error('Windows auth requires msnodesqlv8. See README.md.');
            }
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
            }).connect();
        }
        else if (mode === 'sql') {
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
        }
        else {
            throw new Error('DB_AUTH_MODE must be windows or sql');
        }
        this.logger.log(`Connected to SQL Server database ${database}`);
    }
    request() {
        if (!this.pool?.connected)
            throw new Error('Database is not connected');
        return this.pool.request();
    }
    async onModuleDestroy() {
        if (this.pool)
            await this.pool.close();
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = DatabaseService_1 = __decorate([
    (0, common_1.Injectable)()
], DatabaseService);
//# sourceMappingURL=database.service.js.map