CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  category VARCHAR(30) NOT NULL,
  lang_metadata JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (category <> ''),
  CHECK (jsonb_typeof(lang_metadata) = 'object'),
  CHECK (lang_metadata ? 'en')
);

CREATE INDEX IF NOT EXISTS tags_category_deleted_sort_idx
  ON tags (category, deleted_at, sort_order, id);

CREATE INDEX IF NOT EXISTS tags_lang_metadata_en_idx
  ON tags (category, (lang_metadata ->> 'en'));

CREATE TABLE IF NOT EXISTS user_tags (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  tag_id BIGINT NOT NULL,
  "desc" TEXT NOT NULL DEFAULT '',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag_id)
);

CREATE INDEX IF NOT EXISTS user_tags_user_deleted_idx
  ON user_tags (user_id, deleted_at, updated_at DESC);

CREATE INDEX IF NOT EXISTS user_tags_tag_deleted_idx
  ON user_tags (tag_id, deleted_at);

CREATE TABLE IF NOT EXISTS tweet_tag_matches (
  id BIGSERIAL PRIMARY KEY,
  trace_id TEXT NOT NULL,
  tweet_id TEXT NOT NULL DEFAULT '',
  tag_id BIGINT NOT NULL,
  tag_category VARCHAR(30) NOT NULL,
  tag_lang_metadata JSONB NOT NULL,
  tweet_payload JSONB NOT NULL,
  llm_result JSONB NOT NULL,
  pushed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tag_category <> ''),
  CHECK (jsonb_typeof(tag_lang_metadata) = 'object'),
  CHECK (jsonb_typeof(tweet_payload) = 'object'),
  CHECK (jsonb_typeof(llm_result) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS tweet_tag_matches_tweet_tag_unique_idx
  ON tweet_tag_matches (tweet_id, tag_id)
  WHERE tweet_id <> '';

CREATE INDEX IF NOT EXISTS tweet_tag_matches_tag_created_idx
  ON tweet_tag_matches (tag_id, created_at DESC);

WITH seed_tags(category, name_en, sort_order) AS (
  VALUES
    ('country', 'United States', 1),
    ('country', 'Canada', 2),
    ('country', 'Mexico', 3),
    ('country', 'Curaçao', 4),
    ('country', 'Haiti', 5),
    ('country', 'Panama', 6),
    ('country', 'Australia', 7),
    ('country', 'Iran', 8),
    ('country', 'Japan', 9),
    ('country', 'Jordan', 10),
    ('country', 'South Korea', 11),
    ('country', 'Qatar', 12),
    ('country', 'Saudi Arabia', 13),
    ('country', 'Uzbekistan', 14),
    ('country', 'Iraq', 15),
    ('country', 'Algeria', 16),
    ('country', 'Cape Verde', 17),
    ('country', 'Côte d''Ivoire', 18),
    ('country', 'Egypt', 19),
    ('country', 'Ghana', 20),
    ('country', 'Morocco', 21),
    ('country', 'Senegal', 22),
    ('country', 'South Africa', 23),
    ('country', 'Tunisia', 24),
    ('country', 'DR Congo', 25),
    ('country', 'Argentina', 26),
    ('country', 'Brazil', 27),
    ('country', 'Colombia', 28),
    ('country', 'Ecuador', 29),
    ('country', 'Paraguay', 30),
    ('country', 'Uruguay', 31),
    ('country', 'New Zealand', 32),
    ('country', 'England', 33),
    ('country', 'France', 34),
    ('country', 'Croatia', 35),
    ('country', 'Norway', 36),
    ('country', 'Portugal', 37),
    ('country', 'Germany', 38),
    ('country', 'Netherlands', 39),
    ('country', 'Austria', 40),
    ('country', 'Belgium', 41),
    ('country', 'Scotland', 42),
    ('country', 'Spain', 43),
    ('country', 'Switzerland', 44),
    ('country', 'Sweden', 45),
    ('country', 'Türkiye', 46),
    ('country', 'Bosnia and Herzegovina', 47),
    ('country', 'Czechia', 48),
    ('player', 'Messi', 1),
    ('player', 'Mbappé', 2),
    ('player', 'Yamal', 3),
    ('player', 'Ronaldo', 4),
    ('player', 'Bellingham', 5),
    ('player', 'Haaland', 6),
    ('player', 'Son Heung-min', 7),
    ('player', 'Vinícius', 8),
    ('player', 'Kane', 9),
    ('player', 'Perišić', 10)
),
updated_tags AS (
  UPDATE tags
  SET lang_metadata = jsonb_build_object('en', seed_tags.name_en),
      sort_order = seed_tags.sort_order,
      deleted_at = NULL,
      updated_at = now()
  FROM seed_tags
  WHERE tags.category = seed_tags.category
    AND tags.lang_metadata ->> 'en' = seed_tags.name_en
  RETURNING tags.category, tags.lang_metadata ->> 'en' AS name_en
)
INSERT INTO tags (category, lang_metadata, sort_order)
SELECT seed_tags.category, jsonb_build_object('en', seed_tags.name_en), seed_tags.sort_order
FROM seed_tags
WHERE NOT EXISTS (
  SELECT 1
  FROM updated_tags
  WHERE updated_tags.category = seed_tags.category
    AND updated_tags.name_en = seed_tags.name_en
);
