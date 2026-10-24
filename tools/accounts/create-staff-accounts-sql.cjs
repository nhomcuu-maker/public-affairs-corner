'use strict';
// Generates a reviewable, transaction-guarded SQL batch for *new* staff accounts only.
// Passwords enter via stdin on the user's Windows machine, never in argv or generated files.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, scrypt: rawScrypt } = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(rawScrypt);
const ALLOWED = new Set(['editor', 'reviewer', 'publisher']);
function sqlNvarchar(value, length) {
  return `CONVERT(NVARCHAR(${length}), 0x${Buffer.from(value, 'utf16le').toString('hex')}, 0)`;
}
function checkPerson(account, seenRoles, seenEmails) {
  if (!account || !ALLOWED.has(account.role) || seenRoles.has(account.role)) throw Error('Unsupported or duplicate role');
  const name = String(account.name || '').trim();
  const email = String(account.email || '').trim().toLowerCase();
  const password = account.password;
  if (name.length < 2 || name.length > 180 || /[\u0000-\u001f]/.test(name)) throw Error('Name must be 2..180 clean characters');
  if (email.length < 6 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.endsWith('@example.invalid') || email.endsWith('@example.com') || email.endsWith('@example.org'))
    throw Error('A separate real email is required');
  if (seenEmails.has(email)) throw Error('Different staff roles must have distinct email addresses');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    throw Error('Password must be 12..128 characters');
  seenRoles.add(account.role); seenEmails.add(email);
  return { role: account.role, name, email, password };
}
async function generate(raw, output) {
  if (!output || !/\.sql$/i.test(output)) throw Error('Expected output .sql file');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.accounts) || data.accounts.length < 1 || data.accounts.length > 3)
    throw Error('Provide 1..3 new accounts: editor, reviewer and/or publisher');
  const seenRoles = new Set(), seenEmails = new Set();
  const people = data.accounts.map(a => checkPerson(a, seenRoles, seenEmails));
  const rows = [];
  for (const person of people) {
    const salt = randomBytes(32);
    const hash = await scrypt(person.password, salt, 64, { N:16384, r:8, p:1, maxmem:64 * 1024 * 1024 });
    rows.push(`(${sqlNvarchar(person.role, 30)}, ${sqlNvarchar(person.name, 180)}, ${sqlNvarchar(person.email, 254)}, 0x${salt.toString('hex')}, 0x${hash.toString('hex')})`);
  }
  const sql = `-- GOC DAN SINH: ONE-TIME STAFF ACCOUNT PROVISIONING.
-- Generated locally; contains scrypt salt/hash, NEVER cleartext passwords.
-- CAUTION: hash material is sensitive. Do not share this SQL file. Delete it after use.
-- NO automated verification, approval, publication, admin grant or role escalation.
-- New users only. If a matching email already exists, entire batch fails and rolls back.
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Apply BIT = 0; -- 0=PREVIEW/ROLLBACK; 1=COMMIT after full database backup
IF DB_NAME() <> N'GocDanSinh' THROW 59410,N'Wrong database',1;
IF @@TRANCOUNT <> 0 THROW 59411,N'Close existing SSMS transactions first',1;
IF OBJECT_ID(N'dbo.app_user',N'U') IS NULL OR OBJECT_ID(N'dbo.auth_credential',N'U') IS NULL OR
   OBJECT_ID(N'dbo.user_role',N'U') IS NULL OR OBJECT_ID(N'dbo.role',N'U') IS NULL
   THROW 59412,N'Authentication tables missing',1;
DECLARE @Accounts TABLE(
  role_code NVARCHAR(30) NOT NULL PRIMARY KEY,
  display_name NVARCHAR(180) NOT NULL,
  email NVARCHAR(254) NOT NULL UNIQUE,
  salt VARBINARY(32) NOT NULL,
  [hash] VARBINARY(64) NOT NULL
);
INSERT @Accounts(role_code,display_name,email,salt,[hash]) VALUES
${rows.join(',\n')};
IF EXISTS(SELECT 1 FROM @Accounts a WHERE a.role_code NOT IN (N'editor',N'reviewer',N'publisher')
    OR DATALENGTH(a.salt)<>32 OR DATALENGTH(a.[hash])<>64)
   THROW 59413,N'Invalid role or scrypt data',1;
IF EXISTS(SELECT 1 FROM @Accounts a LEFT JOIN dbo.role r ON r.role_code=a.role_code WHERE r.id IS NULL)
   THROW 59414,N'A required role is missing from dbo.role',1;
IF EXISTS(SELECT 1 FROM @Accounts a JOIN dbo.app_user u ON u.email=a.email)
   THROW 59415,N'Email already exists. Do not create a duplicate; review roles first',1;
DECLARE @Created TABLE(user_id BIGINT NOT NULL, email NVARCHAR(254), role_code NVARCHAR(30), display_name NVARCHAR(180));
DECLARE @email NVARCHAR(254), @displayName NVARCHAR(180), @role NVARCHAR(30),
        @salt VARBINARY(32), @hash VARBINARY(64), @newId BIGINT, @roleId BIGINT;
BEGIN TRY
  BEGIN TRAN;
  DECLARE staff_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT email,display_name,role_code,salt,[hash] FROM @Accounts ORDER BY role_code;
  OPEN staff_cursor;
  FETCH NEXT FROM staff_cursor INTO @email,@displayName,@role,@salt,@hash;
  WHILE @@FETCH_STATUS=0
  BEGIN
    IF EXISTS(SELECT 1 FROM dbo.app_user WITH(UPDLOCK,HOLDLOCK) WHERE email=@email)
      THROW 59416,N'Email became occupied concurrently; whole batch rolls back',1;
    SELECT @roleId=id FROM dbo.role WHERE role_code=@role;
    IF @roleId IS NULL THROW 59417,N'Role missing',1;
    INSERT dbo.app_user(display_name,email,account_status,created_at)
      VALUES(@displayName,@email,N'active',SYSUTCDATETIME());
    SET @newId=CONVERT(BIGINT,SCOPE_IDENTITY());
    INSERT dbo.auth_credential(user_id,password_salt,password_hash) VALUES(@newId,@salt,@hash);
    INSERT dbo.user_role(user_id,role_id,granted_at) VALUES(@newId,@roleId,SYSUTCDATETIME());
    INSERT @Created(user_id,email,role_code,display_name) VALUES(@newId,@email,@role,@displayName);
    FETCH NEXT FROM staff_cursor INTO @email,@displayName,@role,@salt,@hash;
  END;
  CLOSE staff_cursor;
  DEALLOCATE staff_cursor;
  SELECT @Apply AS ApplyMode,user_id AS NewUserId,display_name AS DisplayName,
         email AS Email,role_code AS AssignedRole,
         CASE WHEN @Apply=1 THEN N'WILL_COMMIT' ELSE N'PREVIEW_WILL_ROLLBACK' END AS TransactionOutcome
  FROM @Created ORDER BY role_code;
  IF @Apply=1
  BEGIN
    COMMIT;
    PRINT N'APPLIED: new staff accounts created with isolated roles. No content changed.';
  END
  ELSE
  BEGIN
    ROLLBACK;
    PRINT N'PREVIEW: all staff account changes ROLLED BACK.';
  END;
END TRY
BEGIN CATCH
  IF CURSOR_STATUS('local','staff_cursor') >= -1
  BEGIN
    IF CURSOR_STATUS('local','staff_cursor') > -1 CLOSE staff_cursor;
    DEALLOCATE staff_cursor;
  END;
  IF @@TRANCOUNT>0 ROLLBACK;
  THROW;
END CATCH;
GO
`;
  const target = path.resolve(output);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target,sql,{encoding:'utf8',flag:'wx',mode:0o600});
  console.log('SQL GENERATED: ' + target);
  console.log('ACCOUNTS: ' + people.map(a=>a.role).join(', '));
  console.log('NO plaintext passwords saved. First run with @Apply=0, then after backup with @Apply=1.');
}
async function main() {
  const out = process.argv[2];
  let input='';
  for await (const chunk of process.stdin) {
    input += chunk.toString('utf8');
    if(Buffer.byteLength(input,'utf8') > 16384) throw Error('Input too long');
  }
  await generate(input,out);
}
if (require.main===module) main().catch(e=>{console.error('ERROR: '+e.message); process.exitCode=1;});
module.exports={generate};
