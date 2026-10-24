USE [GocDanSinh];
GO
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo.assistant_feedback',N'U') IS NULL
  THROW 59011,N'Chua co bang assistant_feedback. Chay SQL 10 truoc.',1;
SELECT N'PASS' AS TestResult, COUNT(*) AS TotalFeedback,
  SUM(CASE WHEN review_status=N'pending' THEN 1 ELSE 0 END) AS PendingFeedback,
  SUM(CASE WHEN review_status=N'reviewed' THEN 1 ELSE 0 END) AS ReviewedFeedback
FROM dbo.assistant_feedback;
SELECT c.name AS ColumnName, t.name AS SqlType
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID(N'dbo.assistant_feedback',N'U') ORDER BY c.column_id;
-- Privacy check: no question, answer or IP address is stored in this table.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.assistant_feedback',N'U')
  AND name IN (N'question',N'answer_text',N'ip_address',N'email',N'full_name',N'raw_text'))
  THROW 59012,N'Phat hien cot khong dung nguyen tac toi thieu du lieu.',1;
SELECT N'PASS - Khong luu cau hoi, cau tra loi, IP hoac email' AS PrivacyTest;
GO
