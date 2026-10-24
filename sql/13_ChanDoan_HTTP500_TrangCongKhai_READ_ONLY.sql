/* DAN SINH AI - public catalog / HTTP 500 diagnostics (SQL Server 2022).
   READ ONLY: SELECT and a connection-local #temporary audit table. No changes
   to user data, evidence, approval, publication or permanent database objects.
   Fix for SQL Server Msg 130: calculate EXISTS/NOT EXISTS in a separate
   SELECT INTO #temp statement, then aggregate only the materialized flags.
*/
USE [GocDanSinh];
GO
SET NOCOUNT ON;
SELECT DB_NAME() AS current_database, SYSUTCDATETIME() AS utc_now;

SELECT checks.table_name,
       CASE WHEN OBJECT_ID(N'dbo.' + checks.table_name, N'U') IS NULL
            THEN N'MISSING' ELSE N'PRESENT' END AS table_status
FROM (VALUES (N'knowledge_item'), (N'knowledge_version'), (N'domain'),
    (N'item_scope'), (N'procedure_detail'), (N'knowledge_version_source'),
    (N'source_snapshot'), (N'source_verification'), (N'item_category'),
    (N'category'), (N'admin_unit'), (N'knowledge_item_link')) AS checks(table_name);
GO

BEGIN TRY
    IF OBJECT_ID(N'tempdb..#gds_version_audit') IS NOT NULL
        DROP TABLE #gds_version_audit;

    /* Evaluate per-version verification separately from COUNT/SUM.
       Avoid aggregate expressions containing subqueries (Msg 130).
       This temporary table exists only for this SQL connection. */
    SELECT v.id AS version_id,
           i.id AS item_id,
           CASE WHEN v.editorial_status = N'published' THEN 1 ELSE 0 END AS marked_published,
           CASE WHEN v.editorial_status = N'published'
                 AND v.approved_by IS NOT NULL AND v.approved_at IS NOT NULL
                 AND v.published_at IS NOT NULL
                 AND v.published_at <= SYSUTCDATETIME()
                 AND v.withdrawn_at IS NULL
                 AND v.effective_from IS NOT NULL
                 AND v.effective_from <= CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()))
                 AND (v.effective_to IS NULL
                      OR v.effective_to > CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME())))
                 AND EXISTS (
                     SELECT 1
                     FROM dbo.knowledge_version_source AS e
                     WHERE e.version_id = v.id
                 )
                 AND NOT EXISTS (
                     SELECT 1
                     FROM dbo.knowledge_version_source AS e
                     OUTER APPLY (
                         SELECT TOP (1) sv.decision, sv.valid_until
                         FROM dbo.source_verification AS sv
                         WHERE sv.source_snapshot_id = e.snapshot_id
                         ORDER BY sv.verified_at DESC, sv.id DESC
                     ) AS latest_verification
                     WHERE e.version_id = v.id
                       AND (latest_verification.decision IS NULL
                            OR latest_verification.decision <> N'accepted'
                            OR (latest_verification.valid_until IS NOT NULL
                                AND latest_verification.valid_until <= SYSUTCDATETIME()))
                 )
                THEN 1 ELSE 0 END AS eligible_published
    INTO #gds_version_audit
    FROM dbo.knowledge_version AS v
    INNER JOIN dbo.knowledge_item AS i ON i.id = v.item_id
    WHERE i.deleted_at IS NULL;

    SELECT d.code AS domain,
           COUNT(DISTINCT i.id) AS all_items,
           COUNT(a.version_id) AS all_versions,
           COALESCE(SUM(a.marked_published), 0) AS marked_published,
           COALESCE(SUM(a.eligible_published), 0) AS eligible_published_versions
    FROM dbo.[domain] AS d
    LEFT JOIN dbo.knowledge_item AS i
           ON i.domain_id = d.id AND i.deleted_at IS NULL
    LEFT JOIN #gds_version_audit AS a ON a.item_id = i.id
    WHERE d.code IN (N'LEGAL', N'ADMIN', N'SCAM')
    GROUP BY d.code
    ORDER BY d.code;

    DROP TABLE #gds_version_audit;
END TRY
BEGIN CATCH
    IF OBJECT_ID(N'tempdb..#gds_version_audit') IS NOT NULL
        DROP TABLE #gds_version_audit;
    SELECT ERROR_NUMBER() AS error_number,
           ERROR_LINE() AS error_line,
           ERROR_MESSAGE() AS read_only_diagnostic_error;
END CATCH;
GO

SELECT o.name AS existing_object, o.type_desc
FROM sys.objects AS o
WHERE o.schema_id = SCHEMA_ID(N'dbo')
  AND o.name IN (N'knowledge_item', N'knowledge_version', N'item_scope',
                 N'procedure_detail', N'knowledge_version_source',
                 N'source_snapshot', N'source_verification', N'knowledge_item_link')
ORDER BY o.name;
GO
