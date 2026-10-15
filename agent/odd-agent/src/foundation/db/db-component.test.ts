import { describe, expect, it } from "vitest";
import { InMemoryLogger } from "../logger/logger-component.js";
import { FoundationDb } from "./db-component.js";

const databaseUrl =
  process.env["ODD_AGENT_TEST_DATABASE_URL"] ??
  "postgres://odd_agent:odd_agent@127.0.0.1:55432/odd_agent";

describe("FoundationDb", () => {
  it("requires logger for init", async () => {
    const db = new FoundationDb();
    await expect(
      db.init({
        provider: "postgres",
        connectionStringSecretRef: "DATABASE_URL",
        maxPoolSize: 1,
        statementTimeoutMs: 1_000,
        idleTimeoutMs: 1_000,
        ssl: false
      })
    ).rejects.toThrow(/requires logger/);
  });

  it.runIf(process.env["ODD_AGENT_DB_E2E"] === "1")(
    "queries and rolls back transactions against Postgres",
    async () => {
      const logger = new InMemoryLogger();
      const db = new FoundationDb();
      await db.init(
        {
          provider: "postgres",
          connectionStringSecretRef: "DATABASE_URL",
          maxPoolSize: 2,
          statementTimeoutMs: 5_000,
          idleTimeoutMs: 5_000,
          ssl: false
        },
        {
          logger,
          secretProvider: { getSecret: () => Promise.resolve(databaseUrl) }
        }
      );
      try {
        const result = await db.query<{ readonly value: number }>({
          text: "select $1::int as value",
          values: [42],
          traceId: "trace_db"
        });
        expect(result.rows[0]?.value).toBe(42);
        await expect(
          db.transaction(async (tx) => {
            await tx.query("create temporary table foundation_tx_test(value int)");
            await tx.query("insert into foundation_tx_test(value) values ($1)", [1]);
            throw new Error("rollback");
          })
        ).rejects.toThrow("rollback");
        expect(
          logger.entries.some((entry) => entry.event === "foundation.db.query_succeeded")
        ).toBe(true);
      } finally {
        await db.close();
      }
    }
  );
});
