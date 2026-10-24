USE [GocDanSinh];
GO
-- BUOC 12. Backup database before running. Idempotent creation; NO existing tables are changed.
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  IF OBJECT_ID(N'dbo.assistant_feedback',N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.assistant_feedback (
      id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_assistant_feedback PRIMARY KEY,
      receipt_sha256 BINARY(32) NOT NULL,
      vote NVARCHAR(16) NOT NULL,
      reason_kind NVARCHAR(30) NOT NULL,
      answer_scope NVARCHAR(12) NOT NULL,
      answer_status NVARCHAR(32) NOT NULL,
      intent NVARCHAR(16) NOT NULL,
      source_count SMALLINT NOT NULL,
      review_status NVARCHAR(16) NOT NULL CONSTRAINT DF_assistant_feedback_review DEFAULT N'pending',
      created_at DATETIME2(3) NOT NULL CONSTRAINT DF_assistant_feedback_created DEFAULT SYSUTCDATETIME(),
      reviewed_by BIGINT NULL,
      reviewed_at DATETIME2(3) NULL,
      CONSTRAINT UQ_assistant_feedback_receipt UNIQUE(receipt_sha256),
      CONSTRAINT CK_assistant_feedback_vote CHECK (vote IN (N'helpful',N'not_helpful')),
      CONSTRAINT CK_assistant_feedback_reason CHECK (reason_kind IN (N'none',N'incorrect',N'outdated',N'missing_source',N'unclear',N'unsafe',N'other')),
      CONSTRAINT CK_assistant_feedback_vote_reason CHECK ((vote=N'helpful' AND reason_kind=N'none') OR (vote=N'not_helpful' AND reason_kind<>N'none')),
      CONSTRAINT CK_assistant_feedback_scope CHECK (answer_scope IN (N'public',N'staff')),
      CONSTRAINT CK_assistant_feedback_status CHECK (answer_status IN (N'AI_GENERATED',N'RETRIEVAL_ONLY',N'PROVIDER_UNAVAILABLE',N'INSUFFICIENT_EVIDENCE')),
      CONSTRAINT CK_assistant_feedback_intent CHECK (intent IN (N'SAFETY',N'BENEFIT',N'PROCEDURE',N'GENERAL')),
      CONSTRAINT CK_assistant_feedback_count CHECK (source_count BETWEEN 0 AND 9),
      CONSTRAINT CK_assistant_feedback_review CHECK (review_status IN (N'pending',N'reviewed')),
      CONSTRAINT FK_assistant_feedback_reviewer FOREIGN KEY (reviewed_by) REFERENCES dbo.app_user(id)
    );
    CREATE INDEX IX_assistant_feedback_queue ON dbo.assistant_feedback(review_status,created_at DESC) INCLUDE(vote,reason_kind,answer_status);
  END
  COMMIT TRANSACTION;
  SELECT N'PASS - Bang dbo.assistant_feedback da san sang' AS TestResult;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
