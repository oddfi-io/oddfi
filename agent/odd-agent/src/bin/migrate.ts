import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadOddAgentConfig } from "../infrastructure/config/load-odd-agent-config.js";
import { EnvSecretProvider } from "../infrastructure/secrets/env-secret-provider.js";
import { FoundationDb } from "../foundation/db/db-component.js";
import { FoundationLogger } from "../foundation/logger/logger-component.js";

const workspaceRoot = resolve(new URL("../..", import.meta.url).pathname);

const config = await loadOddAgentConfig(workspaceRoot);
const secretProvider = new EnvSecretProvider(config.localSecrets);
const logger = new FoundationLogger();
await logger.init({
  level: config.logger.level,
  output: "stdout",
  redactKeys: config.logger.redactKeys
});

const database = new FoundationDb();
try {
  await database.init(
    {
      provider: "postgres",
      connectionStringSecretRef: config.db.connectionStringSecretRef,
      maxPoolSize: 1,
      statementTimeoutMs: 30_000,
      idleTimeoutMs: 5_000,
      ssl: config.db.ssl
    },
    { logger, secretProvider }
  );
  const result = await runMigrations(database, resolve(workspaceRoot, "db", "migrations"));
  process.stdout.write(JSON.stringify({ applied_versions: result.appliedVersions }, null, 2));
  process.stdout.write("\n");
} finally {
  await database.close();
  await logger.close();
}

async function runMigrations(
  database: FoundationDb,
  migrationsDir: string
): Promise<{ readonly appliedVersions: readonly string[] }> {
  await database.query({
    text: `CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  });
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
  const appliedVersions: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/u, "");
    const existing = await database.query<{ readonly version: string }>({
      text: "SELECT version FROM schema_migrations WHERE version = $1",
      values: [version]
    });
    if (existing.rows.length > 0) {
      continue;
    }
    const sql = await readFile(resolve(migrationsDir, file), "utf8");
    await database.transaction(async (tx) => {
      await tx.query(sql);
      await tx.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
    });
    appliedVersions.push(version);
  }
  return { appliedVersions };
}
