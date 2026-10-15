import { join } from "node:path";
import {
  oddAgentConfigSchema,
  type OddAgentConfig
} from "../../models/config/odd-agent-config-model.js";
import { loadYamlFile } from "./yaml-loader.js";

/**
 * 调用流程：加载项目唯一运行时 YAML 配置文件。
 * 入参：workspace 根目录。
 * 出参：key 已转为 camelCase 且通过 schema 校验的 OddAgentConfig。
 */
export const loadOddAgentConfig = async (workspaceRoot: string): Promise<OddAgentConfig> =>
  loadYamlFile(join(workspaceRoot, "config", "odd-agent.yaml"), oddAgentConfigSchema);
