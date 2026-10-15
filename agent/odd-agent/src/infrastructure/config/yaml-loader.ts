import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { isMap, isNode, isScalar, isSeq, LineCounter, parseDocument } from "yaml";
import type { Node } from "yaml";
import type { z } from "zod";
import { AppError } from "../../shared/app-error.js";

/**
 * 调用流程：把单个 snake_case 或 kebab-case 字段名转换为 camelCase。
 * 入参：snake_case、kebab-case 或普通字符串。
 * 出参：camelCase 字符串。
 */
const configKeyToCamel = (value: string): string =>
  value.replace(/[-_]([a-z])/g, (_match: string, letter: string) => letter.toUpperCase());

/**
 * 调用流程：递归把 YAML 的 snake_case / kebab-case key 转为 TypeScript 使用的 camelCase key。
 * 入参：YAML 解析后的任意值。
 * 出参：结构等价、对象 key 已归一化的新值。
 */
const toCamelKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(toCamelKeys);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        configKeyToCamel(key),
        toCamelKeys(nestedValue)
      ])
    );
  }

  return value;
};

/**
 * 调用流程：把 zod 校验错误格式化为带 YAML 字段位置的错误信息。
 * 入参：zod issues、YAML 根节点和行号计数器。
 * 出参：包含字段路径、行列号和错误原因的分号分隔字符串。
 */
const formatZodIssues = (
  issues: readonly z.ZodIssue[],
  rootNode: Node | null,
  lineCounter: LineCounter
): string =>
  issues
    .map((issue) => {
      const path = issue.path.join(".") || "<root>";
      const location = formatNodeLocation(findNodeByPath(rootNode, issue.path), lineCounter);
      return `${path}${location}: ${issue.message}`;
    })
    .join("; ");

/**
 * 调用流程：渲染 YAML AST 节点的源码位置。
 * 入参：YAML 节点和行号计数器。
 * 出参：形如 "(line x, col y)" 的后缀；无位置时返回空字符串。
 */
const formatNodeLocation = (node: Node | null, lineCounter: LineCounter): string => {
  if (node?.range === undefined || node.range === null) {
    return "";
  }

  const position = lineCounter.linePos(node.range[0]);
  return position.line > 0 ? ` (line ${position.line}, col ${position.col})` : "";
};

/**
 * 调用流程：沿 zod issue path 在 YAML AST 中查找对应节点。
 * 入参：YAML 根节点，以及包含 camelCase 字段名或数组下标的 zod path。
 * 出参：用于错误定位的最接近 YAML 节点。
 */
const findNodeByPath = (node: Node | null, path: readonly PropertyKey[]): Node | null => {
  if (path.length === 0 || node === null) {
    return node;
  }

  const [pathSegment, ...restPath] = path;
  if (typeof pathSegment === "number") {
    if (!isSeq(node)) {
      return node;
    }

    const nextNode = node.items[pathSegment];
    return findNodeByPath(isNode(nextNode) ? nextNode : node, restPath);
  }

  if (!isMap(node)) {
    return node;
  }

  const yamlSnakeKey = camelToSnake(String(pathSegment));
  const yamlKebabKey = camelToKebab(String(pathSegment));
  const pair = node.items.find((candidate) => {
    if (!isScalar(candidate.key)) {
      return false;
    }

    return (
      candidate.key.value === yamlSnakeKey ||
      candidate.key.value === yamlKebabKey ||
      candidate.key.value === pathSegment
    );
  });

  return findNodeByPath(isNode(pair?.value) ? pair.value : node, restPath);
};

/**
 * 调用流程：把 schema 的 camelCase 路径转回 YAML 中的 snake_case key。
 * 入参：camelCase 字段名。
 * 出参：snake_case 字段名。
 */
const camelToSnake = (value: string): string =>
  value.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);

/**
 * 调用流程：把 schema 的 camelCase 路径转回 YAML 中的 kebab-case key。
 * 入参：camelCase 字段名。
 * 出参：kebab-case 字段名，用于定位 `embedding-llm` 这类配置。
 */
const camelToKebab = (value: string): string =>
  value.replace(/[A-Z]/g, (letter: string) => `-${letter.toLowerCase()}`);

/**
 * 调用流程：读取、解析、key 归一化并校验 YAML 文件。
 * 入参：文件路径和目标 zod schema。
 * 出参：通过 schema 校验的强类型数据；失败时抛出带文件/行号/schema 细节的 AppError。
 */
export const loadYamlFile = async <T>(filePath: string, schema: z.ZodType<T>): Promise<T> => {
  let raw: string;
  try {
    // 读取失败属于配置错误，启动阶段必须 fail-fast。
    raw = await readFile(filePath, "utf8");
  } catch (cause) {
    throw new AppError({
      code: "CONFIG_FILE_NOT_FOUND",
      message: `failed to read YAML config file ${filePath}`,
      retryable: false,
      cause
    });
  }

  // 使用 LineCounter 解析 YAML，后续 schema 错误才能定位到源码行列。
  const lineCounter = new LineCounter();
  const document = parseDocument(raw, {
    keepSourceTokens: true,
    lineCounter
  });

  // YAML 语法错误先于 zod 校验返回，避免把解析失败误报成字段错误。
  if (document.errors.length > 0) {
    const [firstError] = document.errors;
    const location = firstError?.linePos?.[0];
    const formattedLocation =
      location === undefined ? "" : ` at line ${location.line}, col ${location.col}`;
    throw new AppError({
      code: "CONFIG_YAML_PARSE_FAILED",
      message: `failed to parse YAML config file ${filePath}${formattedLocation}: ${String(firstError)}`,
      retryable: false,
      cause: firstError
    });
  }

  let parsed: unknown;
  try {
    // document.toJS() 由 yaml 包按自身语义处理 anchors/tags。
    parsed = document.toJS();
  } catch (cause) {
    throw new AppError({
      code: "CONFIG_YAML_PARSE_FAILED",
      message: `failed to parse YAML config file ${filePath}: ${String(cause)}`,
      retryable: false,
      cause
    });
  }

  // schema 接收 camelCase key，保持 TypeScript 模型命名一致。
  const validation = schema.safeParse(toCamelKeys(parsed));
  if (!validation.success) {
    throw new AppError({
      code: "CONFIG_SCHEMA_INVALID",
      message: `schema validation failed in ${basename(filePath)}: ${formatZodIssues(
        validation.error.issues,
        document.contents,
        lineCounter
      )}`,
      retryable: false,
      cause: validation.error
    });
  }

  return validation.data;
};
