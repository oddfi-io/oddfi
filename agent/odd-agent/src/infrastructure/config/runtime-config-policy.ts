import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { AppError } from "../../shared/app-error.js";

const allowedConfigFile = "odd-agent.yaml";
const allowedExampleConfigFile = "odd-agent.example.yaml";
const forbiddenRuntimeConfigExtensions = [".yaml", ".yml", ".toml", ".json"];
const forbiddenSkillManifestNames = ["skill.yaml", "skill.yml", "skill.toml", "skill.json"];

/**
 * 调用流程：加载配置前强制检查“单一运行时配置文件”规则。
 * 入参：workspace 根目录。
 * 出参：目录布局合法时正常返回；发现违规文件时抛出列明路径的 AppError。
 */
export const assertSingleRuntimeConfigFile = async (workspaceRoot: string): Promise<void> => {
  // 同时扫描 config/ 与 skills/，因为拆分式 Skill manifest 也被禁止。
  const violations = [
    ...(await findExtraConfigFiles(join(workspaceRoot, "config"), workspaceRoot)),
    ...(await findSkillConfigFiles(join(workspaceRoot, "skills"), workspaceRoot))
  ];

  if (violations.length > 0) {
    throw new AppError({
      code: "CONFIG_LAYOUT_INVALID",
      message: `runtime configuration must live only in config/${allowedConfigFile}; forbidden split config files: ${violations.join(", ")}`,
      retryable: false
    });
  }
};

/**
 * 调用流程：查找 config/ 目录下违规的运行时配置文件。
 * 入参：config 目录路径，以及用于生成相对路径的 workspace 根目录。
 * 出参：违规文件的相对路径列表。
 */
const findExtraConfigFiles = async (
  configDir: string,
  workspaceRoot: string
): Promise<string[]> => {
  const entries = await readdir(configDir, { withFileTypes: true }).catch(() => []);
  const violations: string[] = [];

  for (const entry of entries) {
    const fullPath = join(configDir, entry.name);
    // 嵌套 config 目录也不能继续藏运行时配置。
    if (entry.isDirectory()) {
      violations.push(...(await findRuntimeConfigFiles(fullPath, workspaceRoot)));
      continue;
    }

    // odd-agent.yaml 是本地运行时配置；odd-agent.example.yaml 是仓库模板。
    if (
      forbiddenRuntimeConfigExtensions.some((extension) => entry.name.endsWith(extension)) &&
      entry.name !== allowedConfigFile &&
      entry.name !== allowedExampleConfigFile
    ) {
      violations.push(relative(workspaceRoot, fullPath));
    }
  }

  return violations;
};

/**
 * 调用流程：递归查找 Skill 目录里的本地 manifest 配置文件。
 * 入参：skills 目录路径，以及 workspace 根目录。
 * 出参：违规 skill.yaml/skill.json 等路径列表。
 */
const findSkillConfigFiles = async (
  skillsDir: string,
  workspaceRoot: string
): Promise<string[]> => {
  const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  const violations: string[] = [];

  for (const entry of entries) {
    const fullPath = join(skillsDir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...(await findSkillConfigFiles(fullPath, workspaceRoot)));
      continue;
    }

    if (forbiddenSkillManifestNames.includes(entry.name)) {
      violations.push(relative(workspaceRoot, fullPath));
    }
  }

  return violations;
};

/**
 * 调用流程：递归查找嵌套 config 目录中所有运行时配置形态的文件。
 * 入参：待扫描目录和 workspace 根目录。
 * 出参：违规运行时配置文件路径列表。
 */
const findRuntimeConfigFiles = async (dir: string, workspaceRoot: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const violations: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...(await findRuntimeConfigFiles(fullPath, workspaceRoot)));
      continue;
    }

    if (forbiddenRuntimeConfigExtensions.some((extension) => entry.name.endsWith(extension))) {
      violations.push(relative(workspaceRoot, fullPath));
    }
  }

  return violations;
};
