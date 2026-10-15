package persist

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"

	"github.com/Crypto-Barrett/oddfi-agent-backend/internal/pushtypes"
)

// Repo 封装 push_cards 表的读写。线程安全（依赖 database/sql 连接池 + SQLite WAL）。
type Repo struct {
	db *sql.DB
}

// Open 打开（或新建）SQLite 文件，应用 PRAGMA 并确保 schema 存在。
//
// PRAGMA：
//   - journal_mode = WAL      一写多读并发，SSE handler 查 backlog 不被 writer 阻塞
//   - busy_timeout = 5000     锁竞争时等而非立即 BUSY
//   - synchronous = NORMAL    WAL 下安全且快
//   - temp_store = MEMORY     临时表/索引走内存
//
// 连接池：默认 8 / 4，写操作单 goroutine 串行（见 Persister），读走连接池。
func Open(path string) (*Repo, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("[Persist] open sqlite %q: %w", path, err)
	}
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(4)

	pragmas := []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA busy_timeout = 5000",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA temp_store = MEMORY",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("[Persist] pragma %q: %w", p, err)
		}
	}

	if err := ensureSchema(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Repo{db: db}, nil
}

// Close 关闭底层连接池。
func (r *Repo) Close() error {
	return r.db.Close()
}

// DB 暴露底层连接（仅供测试 + 极少数集成场景使用）。
func (r *Repo) DB() *sql.DB { return r.db }

const schemaSQL = `
CREATE TABLE IF NOT EXISTS push_cards (
  id            TEXT    PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  ingested_at   INTEGER NOT NULL,
  source_handle TEXT    NOT NULL,
  author_handle TEXT    NOT NULL,
  author_name   TEXT,
  original_text TEXT    NOT NULL,
  source_url    TEXT,
  tag           TEXT,
  tag_label     TEXT,
  title         TEXT,
  match_name    TEXT,
  ai_analysis   TEXT,
  suggest       TEXT,
  enrich_status TEXT    NOT NULL DEFAULT 'pending',
  enrich_error  TEXT,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_cards_ingested ON push_cards(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_cards_created  ON push_cards(created_at  DESC);
`

func ensureSchema(db *sql.DB) error {
	if _, err := db.Exec(schemaSQL); err != nil {
		return fmt.Errorf("[Persist] ensure schema: %w", err)
	}
	return nil
}

// InsertCard 写入新卡（基础卡入库时调用）。
// 重复 ID 走 INSERT OR REPLACE —— enrich 完成 + 启动恢复时不会冲突。
func (r *Repo) InsertCard(ctx context.Context, c *pushtypes.PushCard) error {
	// 写入前清洗 AI HTML，防止后续 fan-out XSS
	SanitizeAiAnalysis(c.AiAnalysis)

	aiJSON, err := marshalNullable(c.AiAnalysis)
	if err != nil {
		return fmt.Errorf("[Persist] marshal aiAnalysis id=%s: %w", c.ID, err)
	}
	sugJSON, err := marshalNullable(c.Suggest)
	if err != nil {
		return fmt.Errorf("[Persist] marshal suggest id=%s: %w", c.ID, err)
	}
	if c.UpdatedAt == 0 {
		c.UpdatedAt = time.Now().UnixMilli()
	}

	const stmt = `
INSERT INTO push_cards (
  id, created_at, ingested_at, source_handle, author_handle, author_name,
  original_text, source_url, tag, tag_label, title, match_name,
  ai_analysis, suggest, enrich_status, enrich_error, updated_at
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(id) DO UPDATE SET
  created_at=excluded.created_at,
  ingested_at=excluded.ingested_at,
  source_handle=excluded.source_handle,
  author_handle=excluded.author_handle,
  author_name=excluded.author_name,
  original_text=excluded.original_text,
  source_url=excluded.source_url,
  updated_at=excluded.updated_at
`

	_, err = r.db.ExecContext(ctx, stmt,
		c.ID, c.CreatedAt, c.IngestedAt, c.SourceHandle, c.AuthorHandle, c.AuthorName,
		c.OriginalText, c.SourceURL, nullStr(c.Tag), nullStr(c.TagLabel), nullStr(c.Title), nullStr(c.Match),
		aiJSON, sugJSON, c.EnrichStatus, nullStr(c.EnrichError), c.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("[Persist] insert card id=%s: %w", c.ID, err)
	}
	return nil
}

// UpdateEnrich 仅更新 enrich 相关字段；不动 created_at/ingested_at 等基础字段。
func (r *Repo) UpdateEnrich(ctx context.Context, c *pushtypes.PushCard) error {
	SanitizeAiAnalysis(c.AiAnalysis)
	aiJSON, err := marshalNullable(c.AiAnalysis)
	if err != nil {
		return fmt.Errorf("[Persist] marshal aiAnalysis id=%s: %w", c.ID, err)
	}
	sugJSON, err := marshalNullable(c.Suggest)
	if err != nil {
		return fmt.Errorf("[Persist] marshal suggest id=%s: %w", c.ID, err)
	}
	c.UpdatedAt = time.Now().UnixMilli()

	const stmt = `
UPDATE push_cards SET
  tag=?, tag_label=?, title=?, match_name=?,
  ai_analysis=?, suggest=?, enrich_status=?, enrich_error=?, updated_at=?
WHERE id=?
`
	_, err = r.db.ExecContext(ctx, stmt,
		nullStr(c.Tag), nullStr(c.TagLabel), nullStr(c.Title), nullStr(c.Match),
		aiJSON, sugJSON, c.EnrichStatus, nullStr(c.EnrichError), c.UpdatedAt,
		c.ID,
	)
	if err != nil {
		return fmt.Errorf("[Persist] update enrich id=%s: %w", c.ID, err)
	}
	return nil
}

// LoadRecent 取最近 limit 条（按 ingested_at DESC），用于启动 warmup。
// 返回顺序：最新在前。
func (r *Repo) LoadRecent(ctx context.Context, limit int) ([]*pushtypes.PushCard, error) {
	if limit <= 0 {
		return nil, nil
	}
	const stmt = `
SELECT id, created_at, ingested_at, source_handle, author_handle, author_name,
       original_text, source_url, tag, tag_label, title, match_name,
       ai_analysis, suggest, enrich_status, enrich_error, updated_at
FROM push_cards ORDER BY ingested_at DESC LIMIT ?
`
	return r.queryCards(ctx, stmt, limit)
}

// QueryCardsSince 按 ingested_at >= sinceMs 升序取，最多 limit 条。
// 用于 SSE backlog 补发；调用方应对 sinceMs 做 72h clamp（见 server）。
func (r *Repo) QueryCardsSince(ctx context.Context, sinceMs int64, limit int) ([]*pushtypes.PushCard, error) {
	if limit <= 0 {
		return nil, nil
	}
	// 服务端硬上限：即使 caller 传更大也不放行（防 since=0 全表扫描放大）
	if limit > 500 {
		limit = 500
	}
	const stmt = `
SELECT id, created_at, ingested_at, source_handle, author_handle, author_name,
       original_text, source_url, tag, tag_label, title, match_name,
       ai_analysis, suggest, enrich_status, enrich_error, updated_at
FROM push_cards
WHERE ingested_at >= ?
ORDER BY ingested_at ASC
LIMIT ?
`
	return r.queryCards(ctx, stmt, sinceMs, limit)
}

// QueryCardsBefore 按 ingested_at < beforeMs 降序取（最新的在前），最多 limit 条。
// 用于 REST 翻页冷路径。
func (r *Repo) QueryCardsBefore(ctx context.Context, beforeMs int64, limit int) ([]*pushtypes.PushCard, error) {
	if limit <= 0 {
		return nil, nil
	}
	if limit > 100 {
		limit = 100
	}
	const stmt = `
SELECT id, created_at, ingested_at, source_handle, author_handle, author_name,
       original_text, source_url, tag, tag_label, title, match_name,
       ai_analysis, suggest, enrich_status, enrich_error, updated_at
FROM push_cards
WHERE ingested_at < ?
ORDER BY ingested_at DESC
LIMIT ?
`
	return r.queryCards(ctx, stmt, beforeMs, limit)
}

func (r *Repo) queryCards(ctx context.Context, stmt string, args ...any) ([]*pushtypes.PushCard, error) {
	rows, err := r.db.QueryContext(ctx, stmt, args...)
	if err != nil {
		return nil, fmt.Errorf("[Persist] query cards: %w", err)
	}
	defer rows.Close()

	var out []*pushtypes.PushCard
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("[Persist] rows iter: %w", err)
	}
	return out, nil
}

// rowScanner 让 *sql.Row 和 *sql.Rows 共用 scanCard。
type rowScanner interface {
	Scan(dest ...any) error
}

func scanCard(s rowScanner) (*pushtypes.PushCard, error) {
	var (
		c                                                                                 pushtypes.PushCard
		tag, tagLabel, title, matchName, aiJSON, sugJSON, enrichErr, authorName, sourceURL sql.NullString
	)
	if err := s.Scan(
		&c.ID, &c.CreatedAt, &c.IngestedAt, &c.SourceHandle, &c.AuthorHandle, &authorName,
		&c.OriginalText, &sourceURL, &tag, &tagLabel, &title, &matchName,
		&aiJSON, &sugJSON, &c.EnrichStatus, &enrichErr, &c.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("[Persist] scan card: %w", err)
	}
	c.AuthorName = authorName.String
	c.SourceURL = sourceURL.String
	c.Tag = tag.String
	c.TagLabel = tagLabel.String
	c.Title = title.String
	c.Match = matchName.String
	c.EnrichError = enrichErr.String

	if aiJSON.Valid && aiJSON.String != "" {
		var ai pushtypes.AiAnalysis
		if err := json.Unmarshal([]byte(aiJSON.String), &ai); err != nil {
			return nil, fmt.Errorf("[Persist] unmarshal aiAnalysis id=%s: %w", c.ID, err)
		}
		c.AiAnalysis = &ai
	}
	if sugJSON.Valid && sugJSON.String != "" {
		var sug pushtypes.Suggest
		if err := json.Unmarshal([]byte(sugJSON.String), &sug); err != nil {
			return nil, fmt.Errorf("[Persist] unmarshal suggest id=%s: %w", c.ID, err)
		}
		c.Suggest = &sug
	}

	// 重建展示字段（兼容期）
	if c.AuthorHandle != "" {
		c.Source = "🐦 " + c.AuthorHandle
	}
	c.Time = pushtypes.FormatRelativeTime(c.CreatedAt)
	c.AiEnriched = c.EnrichStatus == "ok"
	return &c, nil
}

// ErrNoRows 兼容 sql.ErrNoRows，供调用方 errors.Is 判断。
var ErrNoRows = sql.ErrNoRows

// GetCard 按 ID 取单条；不存在返回 (nil, nil)。
func (r *Repo) GetCard(ctx context.Context, id string) (*pushtypes.PushCard, error) {
	const stmt = `
SELECT id, created_at, ingested_at, source_handle, author_handle, author_name,
       original_text, source_url, tag, tag_label, title, match_name,
       ai_analysis, suggest, enrich_status, enrich_error, updated_at
FROM push_cards WHERE id = ?
`
	row := r.db.QueryRowContext(ctx, stmt, id)
	c, err := scanCard(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return c, nil
}

func marshalNullable(v any) (any, error) {
	if v == nil {
		return nil, nil
	}
	// 用反射判 nil pointer
	switch x := v.(type) {
	case *pushtypes.AiAnalysis:
		if x == nil {
			return nil, nil
		}
		b, err := json.Marshal(x)
		if err != nil {
			return nil, err
		}
		return string(b), nil
	case *pushtypes.Suggest:
		if x == nil {
			return nil, nil
		}
		b, err := json.Marshal(x)
		if err != nil {
			return nil, err
		}
		return string(b), nil
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		return string(b), nil
	}
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
