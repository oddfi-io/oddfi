import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { loadOddAgentConfig } from "../src/infrastructure/config/load-odd-agent-config.js";

const workspaceRoot = resolve(new URL("..", import.meta.url).pathname);

type AppliedMigration = {
  readonly version: string;
};

const config = await loadOddAgentConfig(workspaceRoot);
const connectionString =
  process.env.SUPABASE_DATABASE_URL ??
  process.env[config.db.connectionStringSecretRef] ??
  config.localSecrets?.[config.db.connectionStringSecretRef];

if (connectionString === undefined || connectionString.length === 0) {
  throw new Error(
    `Missing Supabase connection string. Set SUPABASE_DATABASE_URL or ${config.db.connectionStringSecretRef}.`
  );
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 5_000,
  statement_timeout: 60_000,
  ssl: { rejectUnauthorized: false }
});

try {
  await pool.query("select 1");
  await ensureSchemaMigrations(pool);
  const appliedMigrations = await runMigrations(pool, resolve(workspaceRoot, "db", "migrations"));
  await ensureEmbeddingCollection(pool, {
    collectionName: config.memory.embeddingCollectionName,
    dimension: config.memory.embeddingDimension,
    distance: config.memory.embeddingDistance
  });

  const tables = await listManagedTables(pool, config.memory.embeddingCollectionName);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        applied_migrations: appliedMigrations.map((migration) => migration.version),
        managed_tables: tables
      },
      null,
      2
    )}\n`
  );
} catch (cause) {
  const message = cause instanceof Error ? cause.message : String(cause);
  process.stderr.write(
    `${JSON.stringify(
      {
        ok: false,
        error: message,
        hint: "Could not connect to Supabase Postgres. If the direct connection is blocked by your network, use the Supabase pooler connection string in SUPABASE_DATABASE_URL."
      },
      null,
      2
    )}\n`
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}

async function ensureSchemaMigrations(database: Pool): Promise<void> {
  await database.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

async function runMigrations(
  database: Pool,
  migrationsDir: string
): Promise<readonly AppliedMigration[]> {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
  const applied: AppliedMigration[] = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/u, "");
    const existing = await database.query<{ readonly version: string }>(
      "SELECT version FROM schema_migrations WHERE version = $1",
      [version]
    );
    if (existing.rows.length > 0) {
      continue;
    }

    const sql = await readFile(resolve(migrationsDir, file), "utf8");
    await withTransaction(database, async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
    });
    applied.push({ version });
  }

  return applied;
}

async function ensureEmbeddingCollection(
  database: Pool,
  input: {
    readonly collectionName: string;
    readonly dimension: number;
    readonly distance: "cosine" | "dot" | "l2";
  }
): Promise<void> {
  assertSafeIdentifier(input.collectionName, "memory.embedding_collection_name");
  await database.query("CREATE EXTENSION IF NOT EXISTS vector");
  await database.query(`CREATE TABLE IF NOT EXISTS ${input.collectionName} (
    user_id text NOT NULL,
    id text NOT NULL,
    content text NOT NULL,
    metadata jsonb NOT NULL,
    embedding vector(${input.dimension}) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, id)
  )`);
  await assertEmbeddingDimension(database, input.collectionName, input.dimension);
  await database.query(`CREATE INDEX IF NOT EXISTS ${input.collectionName}_embedding_${input.distance}_hnsw_idx
    ON ${input.collectionName}
    USING hnsw (embedding ${pgVectorOps(input.distance)})`);
  await database.query(`CREATE INDEX IF NOT EXISTS ${input.collectionName}_metadata_gin_idx
    ON ${input.collectionName}
    USING gin (metadata jsonb_path_ops)`);
  await database.query(`CREATE INDEX IF NOT EXISTS ${input.collectionName}_user_created_idx
    ON ${input.collectionName} (user_id, created_at DESC)`);
}

async function assertEmbeddingDimension(
  database: Pool,
  collectionName: string,
  expectedDimension: number
): Promise<void> {
  const result = await database.query<{ readonly actual_dimension: number | string | null }>(
    `SELECT atttypmod AS actual_dimension
     FROM pg_attribute
     WHERE attrelid = $1::regclass
       AND attname = 'embedding'
       AND NOT attisdropped`,
    [collectionName]
  );
  const actualDimension = Number(result.rows[0]?.actual_dimension);
  if (actualDimension !== expectedDimension) {
    throw new Error(
      `Embedding collection dimension mismatch: expected ${expectedDimension}, got ${String(
        result.rows[0]?.actual_dimension
      )}`
    );
  }
}

async function listManagedTables(
  database: Pool,
  embeddingCollectionName: string
): Promise<readonly string[]> {
  const result = await database.query<{ readonly table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
     ORDER BY table_name`,
    [
      [
        "schema_migrations",
        "tags",
        "user_tags",
        "tweet_tag_matches",
        "conversaction",
        "conversaction_detail",
        embeddingCollectionName
      ]
    ]
  );
  return result.rows.map((row) => row.table_name);
}

async function withTransaction<T>(
  database: Pool,
  handler: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (cause) {
    await client.query("ROLLBACK");
    throw cause;
  } finally {
    client.release();
  }
}

function assertSafeIdentifier(value: string, label: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(value)) {
    throw new Error(`${label} must be a safe SQL identifier`);
  }
}

function pgVectorOps(distance: "cosine" | "dot" | "l2"): string {
  if (distance === "cosine") {
    return "vector_cosine_ops";
  }
  if (distance === "dot") {
    return "vector_ip_ops";
  }
  return "vector_l2_ops";
}
