// The public API MUST filter publication state + time + withdrawal.
// Date is computed for Vietnam local calendar date (UTC+7, no daylight savings).
export const PUBLIC_VISIBILITY = `
  AND kv.editorial_status = N'published'
  AND kv.approved_at IS NOT NULL
  AND kv.approved_by IS NOT NULL
  AND kv.published_at IS NOT NULL
  AND kv.published_at <= SYSUTCDATETIME()
  AND kv.withdrawn_at IS NULL
  AND kv.effective_from IS NOT NULL
  AND kv.effective_from <= CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()))
  AND (kv.effective_to IS NULL
       OR kv.effective_to > CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME())))
  -- Defense in depth: a published article must still have accepted, unexpired evidence.
  AND EXISTS (
    SELECT 1 FROM dbo.knowledge_version_source AS e
    WHERE e.version_id = kv.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.knowledge_version_source AS e
    OUTER APPLY (
      SELECT TOP (1) sv.decision, sv.valid_until
      FROM dbo.source_verification AS sv
      WHERE sv.source_snapshot_id = e.snapshot_id
      ORDER BY sv.verified_at DESC, sv.id DESC
    ) AS verification
    WHERE e.version_id = kv.id
      AND (
        verification.decision IS NULL
        OR verification.decision <> N'accepted'
        OR (verification.valid_until IS NOT NULL
            AND verification.valid_until <= SYSUTCDATETIME())
      )
  )
`;

export const PUBLIC_LIST_SQL = `
  WITH visible AS (
    SELECT
      ki.id AS itemId, ki.business_code AS businessCode,
      kv.id AS versionId, kv.version_no AS versionNo,
      kv.title, kv.summary, pd.procedure_code AS procedureCode,
      ROW_NUMBER() OVER (
        PARTITION BY ki.id
        ORDER BY kv.effective_from DESC, kv.version_no DESC
      ) AS rn
    FROM dbo.knowledge_item AS ki
    INNER JOIN dbo.[domain] AS d ON d.id = ki.domain_id
    INNER JOIN dbo.knowledge_version AS kv ON kv.item_id = ki.id
    INNER JOIN dbo.procedure_detail AS pd ON pd.version_id = kv.id
    WHERE d.code = N'ADMIN'
      AND ki.kind = N'procedure'
      AND ki.deleted_at IS NULL
      ${PUBLIC_VISIBILITY}
      AND EXISTS (
        SELECT 1 FROM dbo.item_scope AS sc
        WHERE sc.version_id = kv.id
          AND (sc.scope_kind = N'nationwide'
               OR (@provinceCode IS NOT NULL AND sc.scope_kind = N'unit' AND EXISTS (
                 SELECT 1 FROM dbo.admin_unit AS au
                 WHERE au.id = sc.admin_unit_id
                   AND au.official_code = @provinceCode
                   AND au.level = N'province'
                   AND au.valid_from <= CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()))
                   AND (au.valid_to IS NULL OR au.valid_to > CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME())))
               )))
      )
  )
  SELECT TOP (50) itemId, businessCode, versionId, versionNo, title, summary, procedureCode
  FROM visible WHERE rn = 1 ORDER BY title;
`;

export function detailSql(publishedOnly: boolean): string {
  return `
    SELECT TOP (1)
      ki.id AS itemId, ki.business_code AS businessCode,
      kv.id AS versionId, kv.version_no AS versionNo,
      kv.editorial_status AS editorialStatus,
      kv.title, kv.summary, kv.body_markdown AS bodyMarkdown,
      pd.procedure_code AS procedureCode,
      pd.eligibility_note AS eligibilityNote,
      pd.processing_time_text AS processingTime,
      pd.result_description AS resultDescription
    FROM dbo.knowledge_item AS ki
    INNER JOIN dbo.[domain] AS d ON d.id = ki.domain_id
    INNER JOIN dbo.knowledge_version AS kv ON kv.item_id = ki.id
    INNER JOIN dbo.procedure_detail AS pd ON pd.version_id = kv.id
    WHERE ki.business_code = @businessCode
      AND d.code = N'ADMIN'
      AND ki.kind = N'procedure'
      AND ki.deleted_at IS NULL
      ${publishedOnly ? PUBLIC_VISIBILITY : ''}
      ${publishedOnly ? `AND EXISTS (
        SELECT 1 FROM dbo.item_scope sc
        WHERE sc.version_id = kv.id AND (
          sc.scope_kind = N'nationwide' OR
          (@provinceCode IS NOT NULL AND sc.scope_kind = N'unit' AND EXISTS (
            SELECT 1 FROM dbo.admin_unit au
            WHERE au.id = sc.admin_unit_id AND au.official_code = @provinceCode
              AND au.level = N'province'
              AND au.valid_from <= CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME()))
              AND (au.valid_to IS NULL OR au.valid_to > CONVERT(date, DATEADD(hour, 7, SYSUTCDATETIME())))
          ))
        )
      ))` : ''}
    ORDER BY kv.version_no DESC, kv.id DESC;
  `;
}
