import { AppError } from "../shared/app-error.js";
import type { LoggerComponent } from "./logger/logger-component.js";

export type FoundationComponentName =
  | "llm"
  | "llm_embedding"
  | "db"
  | "redis"
  | "embedding_db"
  | "logger";

export type FoundationHealth = {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly message: string;
  readonly checkedAt: string;
};

export type SecretProvider = {
  readonly getSecret: (secretRef: string) => Promise<string>;
};

export type FoundationInitDeps = {
  readonly logger?: LoggerComponent;
  readonly secretProvider?: SecretProvider;
};

export type FoundationComponent<TConfig> = {
  readonly init: (config: TConfig, deps?: FoundationInitDeps) => Promise<void>;
  readonly healthCheck: () => Promise<FoundationHealth>;
  readonly close: () => Promise<void>;
};

export const createFoundationError = (input: {
  readonly component: FoundationComponentName;
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly cause?: unknown;
}): AppError =>
  new AppError({
    code: input.code,
    message: `[${input.component}] ${input.message}`,
    retryable: input.retryable,
    cause: input.cause
  });

export const requireFoundationLogger = (
  component: Exclude<FoundationComponentName, "logger">,
  deps: FoundationInitDeps | undefined
): LoggerComponent => {
  if (deps?.logger === undefined) {
    throw createFoundationError({
      component,
      code: "FOUNDATION_LOGGER_REQUIRED",
      message: `${component} init requires logger`,
      retryable: false
    });
  }
  return deps.logger;
};

export const resolveSecret = async (
  component: Exclude<FoundationComponentName, "logger">,
  deps: FoundationInitDeps | undefined,
  secretRef: string
): Promise<string> => {
  if (deps?.secretProvider === undefined) {
    throw createFoundationError({
      component,
      code: "FOUNDATION_SECRET_PROVIDER_REQUIRED",
      message: `${component} init requires secret provider`,
      retryable: false
    });
  }
  const value = await deps.secretProvider.getSecret(secretRef);
  if (value.length === 0) {
    throw createFoundationError({
      component,
      code: "FOUNDATION_SECRET_EMPTY",
      message: `secret is empty: ${secretRef}`,
      retryable: false
    });
  }
  return value;
};

export const nowIso = (): string => new Date().toISOString();

export const normalizeError = (cause: unknown): Readonly<Record<string, unknown>> =>
  cause instanceof Error
    ? { name: cause.name, message: cause.message }
    : { message: String(cause) };
