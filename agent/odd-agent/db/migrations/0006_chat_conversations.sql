CREATE TABLE IF NOT EXISTS conversaction (
  id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(200) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (conversation_id <> ''),
  CHECK (user_id <> ''),
  CHECK (name <> ''),
  UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS conversaction_user_deleted_updated_idx
  ON conversaction (user_id, deleted_at, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS conversaction_detail (
  id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(200) NOT NULL,
  msg_id VARCHAR(200) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  direction INTEGER NOT NULL,
  message TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (conversation_id <> ''),
  CHECK (msg_id <> ''),
  CHECK (user_id <> ''),
  CHECK (direction IN (0, 1)),
  UNIQUE (msg_id)
);

CREATE INDEX IF NOT EXISTS conversaction_detail_conversation_user_created_idx
  ON conversaction_detail (conversation_id, user_id, deleted_at, created_at ASC, id ASC);
