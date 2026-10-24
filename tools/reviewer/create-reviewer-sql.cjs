'use strict';
// Creates a one-time, transaction-guarded T-SQL file containing ONLY salt and scrypt hash.
// No plaintext password is written to disk, logged or added to command-line arguments.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
function sqlText(value, type) {
  return `CONVERT(NVARCHAR(${type}), 0x${Buffer.from(value, 'utf16le').toString('hex')}, 0)`;
}
(async () => {
  const outfile = process.argv[2];
  if (!outfile || !/\.sql$/i.test(outfile)) throw Error('Expected output .sql path');
  let input = '';
  for await (const part of process.stdin) {
    input += part.toString('utf8');
    if (Buffer.byteLength(input, 'utf8') > 4096) throw Error('Input too long');
  }
  let parsed;
  try { parsed = JSON.parse(input); } catch { throw Error('Input JSON invalid'); }
  const name = String(parsed.name ?? '').trim();
  const email = String(parsed.email ?? '').trim().toLowerCase();
  const password = parsed.password;
  if (name.length < 2 || name.length > 180) throw Error('Name must be 2..180 characters');
  if (email.length < 6 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('@example.invalid'))
    throw Error('Real reviewer email required (not example.invalid)');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw Error('Password must be 12..128 characters');
  const salt = crypto.randomBytes(32);
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const sql = `-- GOC DAN SINH: NEW REVIEWER ACCOUNT (scrypt N=16384,r=8,p=1)
-- Generated on local PC; never contains the plaintext password.
-- Open SSMS, check database backup, run @Apply=0 first; then set @Apply=1.
-- It creates only ONE new reviewer user and login credentials; no admin/publisher role.
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Apply BIT = 0;
DECLARE @Email NVARCHAR(254) = ${sqlText(email, 254)};
DECLARE @DisplayName NVARCHAR(180) = ${sqlText(name, 180)};
DECLARE @Salt VARBINARY(32) = 0x${salt.toString('hex')};
DECLARE @PasswordHash VARBINARY(64) = 0x${hash.toString('hex')};
DECLARE @ReviewerRoleId BIGINT;
DECLARE @NewUserId BIGINT;
IF DB_NAME() <> N'GocDanSinh' THROW 59300, N'Incorrect database', 1;
IF OBJECT_ID(N'dbo.app_user',N'U') IS NULL OR OBJECT_ID(N'dbo.auth_credential',N'U') IS NULL OR
   OBJECT_ID(N'dbo.[role]',N'U') IS NULL OR OBJECT_ID(N'dbo.user_role',N'U') IS NULL
   THROW 59301, N'Application authentication tables are missing', 1;
IF DATALENGTH(@Salt)<>32 OR DATALENGTH(@PasswordHash)<>64
   THROW 59302, N'Invalid scrypt salt/hash byte lengths', 1;
IF EXISTS (SELECT 1 FROM dbo.app_user WHERE email=@Email)
   THROW 59303, N'Account email already exists: use a DIFFERENT real email; no existing user is modified', 1;
SELECT @ReviewerRoleId=id FROM dbo.[role] WHERE role_code=N'reviewer';
IF @ReviewerRoleId IS NULL THROW 59304, N'Reviewer role not found', 1;
BEGIN TRY
  BEGIN TRAN;
  IF EXISTS (SELECT 1 FROM dbo.app_user WITH(UPDLOCK,HOLDLOCK) WHERE email=@Email)
      THROW 59305, N'Email became occupied concurrently', 1;
  INSERT dbo.app_user(display_name,email,account_status,created_at)
      VALUES(@DisplayName,@Email,N'active',SYSUTCDATETIME());
  SET @NewUserId=CONVERT(BIGINT,SCOPE_IDENTITY());
  INSERT dbo.auth_credential(user_id,password_salt,password_hash)
      VALUES(@NewUserId,@Salt,@PasswordHash);
  INSERT dbo.user_role(user_id,role_id,granted_at)
      VALUES(@NewUserId,@ReviewerRoleId,SYSUTCDATETIME());
  SELECT @Apply AS ApplyMode, @NewUserId AS NewUserId, @DisplayName AS DisplayName,
         @Email AS Email, N'reviewer' AS AssignedRole,
         CASE WHEN @Apply=1 THEN N'WILL_COMMIT' ELSE N'PREVIEW_WILL_ROLLBACK' END AS TransactionOutcome;
  IF @Apply=1 BEGIN
      COMMIT;
      PRINT N'APPLIED: reviewer account and scrypt credential saved.';
  END ELSE BEGIN
      ROLLBACK;
      PRINT N'PREVIEW: reviewer account creation ROLLED BACK.';
  END;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK;
  THROW;
END CATCH;
GO
`;
  const resolved = path.resolve(outfile);
  fs.mkdirSync(path.dirname(resolved), {recursive:true});
  fs.writeFileSync(resolved, sql, {encoding:'utf8', flag:'wx', mode:0o600});
  console.log('CREATED SQL: ' + resolved);
  console.log('NO plaintext password saved. Open SQL and run @Apply=0, then @Apply=1 after backup.');
})().catch(err => { console.error('ERROR: '+err.message); process.exitCode=1; });
