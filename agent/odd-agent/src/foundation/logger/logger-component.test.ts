import { describe, expect, it } from "vitest";
import { ROOT_CONTEXT, TraceFlags, context, trace } from "@opentelemetry/api";
import { FoundationLogger, InMemoryLogger, type LogFields } from "./logger-component.js";

describe("FoundationLogger", () => {
  it("redacts configured keys and preserves trace context", async () => {
    const entries: LogFields[] = [];
    const logger = new InMemoryLogger(entries);
    await logger.init({
      level: "debug",
      output: "stdout",
      redactKeys: ["apiKey", "authorization"]
    });

    const activeContext = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: "0123456789abcdef0123456789abcdef",
      spanId: "0123456789abcdef",
      traceFlags: TraceFlags.SAMPLED
    });
    context.with(activeContext, () => {
      logger.info("foundation.logger.test", {
        nested: { apiKey: "secret" },
        authorization: "Bearer secret",
        visible: "ok",
        user_id: "user_1",
        component: "logger"
      });
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      event: "foundation.logger.test",
      trace_id: "0123456789abcdef0123456789abcdef",
      span_id: "0123456789abcdef",
      fields: {
        nested: { apiKey: "[REDACTED]" },
        authorization: "[REDACTED]",
        visible: "ok",
        user_id: "user_1",
        component: "logger"
      }
    });
  });

  it("initializes async local OpenTelemetry context manager", async () => {
    const entries: LogFields[] = [];
    const logger = new InMemoryLogger(entries);
    await logger.init({
      level: "debug",
      output: "stdout",
      redactKeys: []
    });

    await context.with(
      trace.setSpanContext(ROOT_CONTEXT, {
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        traceFlags: TraceFlags.SAMPLED
      }),
      async () => {
        await Promise.resolve();
        logger.info("foundation.logger.async_context");
      }
    );

    expect(entries.at(-1)).toMatchObject({
      event: "foundation.logger.async_context",
      trace_id: "0123456789abcdef0123456789abcdef",
      span_id: "0123456789abcdef"
    });
  });

  it("fails fast when writing before init", () => {
    const logger = new FoundationLogger();
    expect(() => logger.info("foundation.logger.uninitialized")).toThrow(
      /logger is not initialized/
    );
  });
});
