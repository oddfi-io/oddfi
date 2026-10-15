import { AppError } from "../../shared/app-error.js";

export interface SecretProvider {
  /**
   * 调用流程：按 secretRef 读取 secret。
   * 入参：secretRef，通常来自 YAML 中的 *_secret_ref。
   * 出参：secret 字符串；无法解析时由实现抛错。
   */
  getSecret(secretRef: string): Promise<string>;
}

/**
 * 调用流程：从本地 ignored 配置覆盖或 process.env 解析配置中的 secret 引用。
 * 入参：YAML 中的 secret 引用名，例如 ODD_AGENT_SUPERVISOR_LLM_API_KEY。
 * 出参：secret 字符串；缺失时抛出 AppError。
 */
export class EnvSecretProvider implements SecretProvider {
  readonly #localSecrets: Readonly<Record<string, string>>;

  /**
   * 调用流程：保存可选本地 secret 覆盖。
   * 入参：来自 config/odd-agent.yaml 的 local_secrets；该文件不提交。
   * 出参：可按 secretRef 解析 secret 的 provider。
   */
  constructor(localSecrets: Readonly<Record<string, string>> = {}) {
    this.#localSecrets = localSecrets;
  }

  /**
   * 调用流程：按引用名读取一个 secret。
   * 入参：secret 引用名。
   * 出参：非空 secret 字符串。
   */
  getSecret(secretRef: string): Promise<string> {
    // 空字符串无法用于依赖认证，因此按缺失处理。
    const value = this.#localSecrets[secretRef] ?? process.env[secretRef];
    if (value === undefined || value.length === 0) {
      throw new AppError({
        code: "SECRET_NOT_FOUND",
        message: `secret is not configured: ${secretRef}`,
        retryable: false
      });
    }

    return Promise.resolve(value);
  }
}
