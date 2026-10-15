-- DD-134：batch-create 幂等性以 DB unique 约束兜底（项目红线：禁仅靠应用层去重）。
-- 背景：createMany 是 check-then-insert，多实例并发遇到同一新标签时两边都 miss 会重复落库。
-- 步骤 1：清理既有重复的活跃行——同 (category, lang_metadata->>'en') 保留最小 id，其余软删，
-- 保证唯一索引可以创建成功；软删而非物理删除，保留 user_tags 等引用的可恢复性。
UPDATE tags t
SET deleted_at = now(),
    updated_at = now()
WHERE t.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM tags keep
    WHERE keep.deleted_at IS NULL
      AND keep.category = t.category
      AND keep.lang_metadata ->> 'en' = t.lang_metadata ->> 'en'
      AND keep.id < t.id
  );

-- 步骤 2：partial unique index 只约束活跃行；软删行不参与冲突，
-- 与 createMany 的「软删命中 → restore 原 id」路径兼容。
CREATE UNIQUE INDEX IF NOT EXISTS tags_category_en_active_unique
  ON tags (category, (lang_metadata ->> 'en'))
  WHERE deleted_at IS NULL;

-- 回滚：DROP INDEX IF EXISTS tags_category_en_active_unique;
-- （步骤 1 的软删不自动回滚；如需恢复按 updated_at 与业务确认逐条 restore。）
