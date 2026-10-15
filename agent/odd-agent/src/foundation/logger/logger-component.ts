import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import type { FoundationComponent, FoundationHealth } from "../foundation-types.js";
import { createFoundationError, nowIso } from "../foundation-types.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LoggerConfig = {
  readonly level: LogLevel;
  readonly output: "stdout" | "file";
  readonly directory?: string;
  readonly filenamePrefix?: string;
  readonly redactKeys: readonly string[];
};

export type LogFields = Readonly<Record<string, unknown>>;

type LogEntry = LogFields & {
  readonly timestamp?: string;
  readonly level: LogLevel;
  readonly event: string;
  readonly trace_id?: string;
  readonly span_id?: string;
  readonly fields?: LogFields;
};

export type Logger = {
  readonly debug: (event: string, fields?: LogFields) => void;
  readonly info: (event: string, fields?: LogFields) => void;
  readonly warn: (event: string, fields?: LogFields) => void;
  readonly error: (event: string, fields?: LogFields) => void;
};

export type LoggerComponent = FoundationComponent<LoggerConfig> & Logger;

export class FoundationLogger implements LoggerComponent {
  #config: LoggerConfig | undefined;
  #filePath: string | undefined;

  async init(config: LoggerConfig): Promise<void> {
    initializeOpenTelemetryContext();
    this.#config = config;
    if (config.output === "file") {
      const directory = config.directory ?? "logs";
      await mkdir(directory, { recursive: true });
      this.#filePath = join(
        directory,
        `${config.filenamePrefix ?? "odd-agent"}-${formatLocalDate(new Date())}.log`
      );
    }
    this.info("foundation.logger.init_succeeded", {
      output: config.output,
      level: config.level,
      component: "logger"
    });
  }

  async healthCheck(): Promise<FoundationHealth> {
    await Promise.resolve();
    return {
      status: this.#config === undefined ? "unhealthy" : "healthy",
      message: this.#config === undefined ? "logger is not initialized" : "logger initialized",
      checkedAt: nowIso()
    };
  }

  async close(): Promise<void> {
    await Promise.resolve();
  }

  debug(event: string, fields?: LogFields): void {
    this.#write("debug", event, fields);
  }

  info(event: string, fields?: LogFields): void {
    this.#write("info", event, fields);
  }

  warn(event: string, fields?: LogFields): void {
    this.#write("warn", event, fields);
  }

  error(event: string, fields?: LogFields): void {
    this.#write("error", event, fields);
  }

  #write(level: LogLevel, event: string, fields?: LogFields): void {
    const config = this.#config;
    if (config === undefined) {
      throw createFoundationError({
        component: "logger",
        code: "FOUNDATION_NOT_INITIALIZED",
        message: "logger is not initialized",
        retryable: false
      });
    }
    if (!shouldWriteLevel(level, config.level)) {
      return;
    }
    initializeOpenTelemetryContext();
    const entry = redactValue(
      {
        timestamp: nowIso(),
        level,
        event,
        ...buildContextFields(),
        ...(fields === undefined ? {} : { fields })
      },
      config.redactKeys
    ) as LogEntry;
    const line = `${JSON.stringify(entry)}\n`;
    if (config.output === "file" && this.#filePath !== undefined) {
      void appendFile(this.#filePath, line, "utf8");
      return;
    }
    process.stdout.write(line);
  }
}

export class InMemoryLogger implements LoggerComponent {
  readonly entries: LogFields[];
  #config: LoggerConfig = {
    level: "debug",
    output: "stdout",
    redactKeys: ["api_key", "password", "token", "apiKey", "authorization"]
  };

  constructor(entries: LogFields[] = []) {
    this.entries = entries;
  }

  async init(config: LoggerConfig): Promise<void> {
    initializeOpenTelemetryContext();
    this.#config = config;
    await Promise.resolve();
  }

  async healthCheck(): Promise<FoundationHealth> {
    await Promise.resolve();
    return { status: "healthy", message: "in-memory logger initialized", checkedAt: nowIso() };
  }

  async close(): Promise<void> {
    await Promise.resolve();
  }

  debug(event: string, fields?: LogFields): void {
    this.#push("debug", event, fields);
  }

  info(event: string, fields?: LogFields): void {
    this.#push("info", event, fields);
  }

  warn(event: string, fields?: LogFields): void {
    this.#push("warn", event, fields);
  }

  error(event: string, fields?: LogFields): void {
    this.#push("error", event, fields);
  }

  #push(level: LogLevel, event: string, fields?: LogFields): void {
    if (!shouldWriteLevel(level, this.#config.level)) {
      return;
    }
    initializeOpenTelemetryContext();
    this.entries.push(
      redactValue(
        {
          timestamp: nowIso(),
          level,
          event,
          ...buildContextFields(),
          ...(fields === undefined ? {} : { fields })
        },
        this.#config.redactKeys
      ) as LogEntry
    );
  }
}

export const silentLogger: LoggerComponent = new InMemoryLogger();

let openTelemetryContextInitialized = false;

const initializeOpenTelemetryContext = (): void => {
  if (openTelemetryContextInitialized) {
    return;
  }
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  openTelemetryContextInitialized = true;
};

const buildContextFields = (): Partial<LogEntry> => {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  return {
    ...(spanContext === undefined ? {} : { trace_id: spanContext.traceId }),
    ...(spanContext === undefined ? {} : { span_id: spanContext.spanId })
  };
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const levelPriority: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const shouldWriteLevel = (entryLevel: LogLevel, configuredLevel: LogLevel): boolean =>
  levelPriority[entryLevel] >= levelPriority[configuredLevel];

const redactValue = (value: unknown, redactKeys: readonly string[]): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, redactKeys));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const redacted = new Set(redactKeys.map((key) => key.toLowerCase()));
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    output[key] = redacted.has(key.toLowerCase()) ? "[REDACTED]" : redactValue(nested, redactKeys);
  }
  return output;
};
