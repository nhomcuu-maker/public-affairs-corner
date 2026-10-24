import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scrypt as rawScrypt, timingSafeEqual } from 'node:crypto';
import * as sql from 'mssql';
import { DatabaseService } from '../database/database.service';

const LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_REGISTRATIONS = 5;
const SESSION_DAYS = 7;
const hits = new Map<string, { count: number; reset: number }>();
const fakeSalt = Buffer.alloc(32, 1);
const fakeHash = Buffer.alloc(64, 2);

function rate(key: string, max: number): void {
  const now = Date.now();
  if (hits.size > 2500) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const record = hits.get(key);
  if (!record || record.reset < now) { hits.set(key, { count: 1, reset: now + LIMIT_WINDOW }); return; }
  record.count++;
  if (record.count > max) throw new HttpException('Bạn thao tác quá nhiều lần. Hãy thử lại sau 15 phút.', HttpStatus.TOO_MANY_REQUESTS);
}
function txt(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function validEmail(value: unknown): string {
  const email = txt(value).toLowerCase();
  if (email.length < 6 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new BadRequestException('Email không hợp lệ');
  return email;
}
function validPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    throw new BadRequestException('Mật khẩu cần từ 12 đến 128 ký tự');
  return value;
}
async function kdf(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    rawScrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}
function sha(token: string): Buffer { return createHash('sha256').update(token, 'utf8').digest(); }

export type Identity = { id: number; displayName: string; email: string; roles: string[] };
@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async register(body: Record<string, unknown>, ip: string) {
    rate('register:' + ip, MAX_REGISTRATIONS);
    const name = txt(body.displayName);
    const email = validEmail(body.email);
    const password = validPassword(body.password);
    if (name.length < 2 || name.length > 180) throw new BadRequestException('Họ tên cần từ 2 đến 180 ký tự');
    if (password !== body.confirmPassword) throw new BadRequestException('Mật khẩu xác nhận không khớp');
    if (email.endsWith('@example.invalid')) throw new BadRequestException('Không thể đăng ký email mẫu');
    const salt = randomBytes(32);
    const hashed = await kdf(password, salt);
    try {
      // Single SQL batch + transaction: either both user and credential exist, or neither.
      const result = await this.db.request()
        .input('email', sql.NVarChar(254), email)
        .input('name', sql.NVarChar(180), name)
        .input('salt', sql.VarBinary(32), salt)
        .input('hash', sql.VarBinary(64), hashed)
        .query(`
          SET XACT_ABORT ON;
          BEGIN TRY
            BEGIN TRAN;
            INSERT dbo.app_user(display_name,email,account_status,created_at)
              VALUES (@name,@email,N'active',SYSUTCDATETIME());
            DECLARE @newId BIGINT = CONVERT(BIGINT,SCOPE_IDENTITY());
            INSERT dbo.auth_credential(user_id,password_salt,password_hash)
              VALUES (@newId,@salt,@hash);
            COMMIT TRAN;
            SELECT @newId AS id;
          END TRY
          BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRAN;
            THROW;
          END CATCH;
        `);
      return { ok: true, id: result.recordset[0].id, message: 'Đăng ký thành công. Hãy đăng nhập.' };
    } catch (err) {
      // SQL Server duplicate unique email code 2601/2627; driver may nest originalError.
      const message = String((err as Error).message ?? '');
      if (/2601|2627|duplicate|unique index|UX_app_user_email/i.test(message))
        throw new ConflictException('Email đã được đăng ký');
      throw err;
    }
  }

  async login(body: Record<string, unknown>, ip: string): Promise<{ user: Identity; token: string }> {
    const email = validEmail(body.email);
    const password = validPassword(body.password);
    rate('login-ip:' + ip, MAX_ATTEMPTS);
    rate('login-email:' + email, MAX_ATTEMPTS);
    const result = await this.db.request().input('email', sql.NVarChar(254), email).query(`
      SELECT TOP (1) u.id, u.email, u.display_name AS displayName, u.account_status AS accountStatus,
                     c.password_salt AS salt, c.password_hash AS [hash]
      FROM dbo.app_user u
      LEFT JOIN dbo.auth_credential c ON c.user_id=u.id
      WHERE u.email=@email;
    `);
    const found = result.recordset[0];
    const computed = await kdf(password, found?.salt ?? fakeSalt);
    const expected: Buffer = found?.hash ?? fakeHash;
    if (!found || found.accountStatus !== 'active' || !found.salt ||
        expected.length !== computed.length || !timingSafeEqual(expected, computed)) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const token = randomBytes(32).toString('hex');
    await this.db.request().input('token', sql.VarBinary(32), sha(token))
      .input('uid', sql.BigInt, found.id)
      .query(`INSERT dbo.auth_session(token_hash,user_id,expires_at)
              VALUES (@token,@uid,DATEADD(day,${SESSION_DAYS},SYSUTCDATETIME()));`);
    return { token, user: await this.userProfile(found.id) };
  }

  async profile(token: string): Promise<Identity> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException('Bạn chưa đăng nhập');
    const r = await this.db.request().input('token', sql.VarBinary(32), sha(token)).query(`
      SELECT TOP (1) s.user_id AS id
      FROM dbo.auth_session s
      INNER JOIN dbo.app_user u ON u.id=s.user_id
      WHERE s.token_hash=@token AND s.revoked_at IS NULL AND s.expires_at > SYSUTCDATETIME()
        AND u.account_status=N'active';
    `);
    if (!r.recordset.length) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    return this.userProfile(r.recordset[0].id);
  }

  private async userProfile(id: number): Promise<Identity> {
    const info = await this.db.request().input('id',sql.BigInt,id).query(`
      SELECT id, display_name AS displayName, email FROM dbo.app_user
      WHERE id=@id AND account_status=N'active';
    `);
    if (!info.recordset.length) throw new UnauthorizedException();
    const roles = await this.db.request().input('id',sql.BigInt,id).query(`
      SELECT r.role_code AS roleCode FROM dbo.user_role ur
      JOIN dbo.[role] r ON r.id=ur.role_id WHERE ur.user_id=@id ORDER BY r.role_code;
    `);
    return { ...info.recordset[0], roles: roles.recordset.map((x: {roleCode: string})=>x.roleCode) };
  }

  async logout(token: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    await this.db.request().input('token',sql.VarBinary(32),sha(token)).query(`
      UPDATE dbo.auth_session SET revoked_at=SYSUTCDATETIME()
      WHERE token_hash=@token AND revoked_at IS NULL;
    `);
  }
}
