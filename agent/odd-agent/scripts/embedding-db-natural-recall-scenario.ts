import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { FoundationEmbeddingDb } from "../src/foundation/embedding-db/embedding-db-component.js";
import { QdrantEmbeddingDbProvider } from "../src/foundation/embedding-db/embedding-db-provider-qdrant.js";
import { InMemoryLogger } from "../src/foundation/logger/logger-component.js";

const qdrantEndpoint = process.env["QDRANT_ENDPOINT"] ?? "http://127.0.0.1:6333";
const ollamaBaseUrl = process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434";
const ollamaEmbeddingModel = process.env["OLLAMA_EMBEDDING_MODEL"] ?? "all-minilm:latest";
const topK = Number(process.env["NATURAL_RECALL_TOP_K"] ?? "20");
const fullRankTopK = Number(process.env["NATURAL_RECALL_FULL_RANK_TOP_K"] ?? "100");

const ollamaEmbeddingResponseSchema = z.object({
  embedding: z.array(z.number())
});

type RecallItem = {
  readonly id: string;
  readonly sentence: string;
  readonly query: string;
  readonly topic: string;
};

type RecallResult = {
  readonly id: string;
  readonly topic: string;
  readonly query: string;
  readonly expectedSentence: string;
  readonly hitTopK: boolean;
  readonly rank: number | null;
  readonly score: number | null;
  readonly topCandidates: readonly {
    readonly id: string;
    readonly score: number;
    readonly content: string;
    readonly topic: string | undefined;
  }[];
  readonly likelyReason?: string;
};

type RecallMetadata = {
  readonly scenario: string;
  readonly topic: string;
  readonly index: number;
};

type RecallScenario = {
  readonly name: "natural_question" | "exact_sentence";
  readonly description: string;
  readonly results: readonly RecallResult[];
  readonly summary: ReturnType<typeof summarize>;
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  const runId = `natural_recall_${Date.now()}_${randomUUID().replace(/-/gu, "").slice(0, 8)}`;
  const userId = `user_${runId}`;
  const collectionName = `${runId}_vectors`;
  const logger = new InMemoryLogger();
  await logger.init({
    level: "info",
    output: "stdout",
    redactKeys: ["apiKey", "api_key", "authorization", "password", "token"]
  });

  const items = buildRecallItems();
  const seedVector = await embedWithOllama("自然语言召回维度探测");
  const embeddingDb = new FoundationEmbeddingDb();

  await embeddingDb.init(
    {
      collectionName,
      dimension: seedVector.length,
      distance: "cosine",
      topKDefault: topK,
      maxContentBytes: 65_536,
      maxMetadataBytes: 16_384
    },
    { logger, provider: new QdrantEmbeddingDbProvider({ endpoint: qdrantEndpoint }) }
  );

  try {
    for (const [index, item] of items.entries()) {
      await embeddingDb.upsert<RecallMetadata>({
        traceId: `trace_${runId}_upsert_${index}`,
        userId,
        id: item.id,
        vector: await embedWithOllama(item.sentence, seedVector.length),
        content: item.sentence,
        metadata: { scenario: runId, topic: item.topic, index }
      });
    }

    const naturalQuestion = await runRecallScenario({
      name: "natural_question",
      description: "Use a natural-language question for each fact.",
      items,
      userId,
      runId,
      seedDimension: seedVector.length,
      embeddingDb,
      queryOf: (item) => item.query
    });
    const exactSentence = await runRecallScenario({
      name: "exact_sentence",
      description: "Use the original stored sentence as a control query.",
      items,
      userId,
      runId,
      seedDimension: seedVector.length,
      embeddingDb,
      queryOf: (item) => item.sentence
    });
    const semanticRecallOk = naturalQuestion.summary.recallAtTopK === 1;
    const storageRecallOk =
      exactSentence.summary.recallAt1 === 1 &&
      exactSentence.summary.foundWithinFullRank === exactSentence.summary.total;
    const output = {
      ok: storageRecallOk,
      semantic_recall_ok: semanticRecallOk,
      duration_ms: Date.now() - startedAt,
      services: {
        embedding_db_provider: "qdrant",
        qdrant_endpoint: qdrantEndpoint,
        ollama_base_url: ollamaBaseUrl,
        ollama_embedding_model: ollamaEmbeddingModel,
        embedding_dimension: seedVector.length,
        top_k: topK,
        full_rank_top_k: fullRankTopK
      },
      ids: { runId, userId, collectionName },
      scenarios: {
        naturalQuestion,
        exactSentence
      },
      analysis: analyzeResults(naturalQuestion.results),
      misses: naturalQuestion.results.filter((result) => !result.hitTopK),
      worstRanks: [...naturalQuestion.results]
        .sort((left, right) => (right.rank ?? 9999) - (left.rank ?? 9999))
        .slice(0, 10)
    };

    await mkdir("tmp/embedding-natural-recall", { recursive: true });
    await writeFile(
      "tmp/embedding-natural-recall/latest.json",
      `${JSON.stringify(output, null, 2)}\n`
    );
    process.stdout.write(`${JSON.stringify(compactOutput(output), null, 2)}\n`);
    if (!output.ok) {
      process.exitCode = 1;
    }
  } finally {
    await embeddingDb.deleteByUser(userId).catch(() => undefined);
    await embeddingDb.close();
  }
};

const runRecallScenario = async (params: {
  readonly name: RecallScenario["name"];
  readonly description: string;
  readonly items: readonly RecallItem[];
  readonly userId: string;
  readonly runId: string;
  readonly seedDimension: number;
  readonly embeddingDb: FoundationEmbeddingDb;
  readonly queryOf: (item: RecallItem) => string;
}): Promise<RecallScenario> => {
  const results: RecallResult[] = [];
  for (const item of params.items) {
    const query = params.queryOf(item);
    const queryVector = await embedWithOllama(query, params.seedDimension);
    const ranked = await params.embeddingDb.search<
      { readonly scenario: string },
      RecallMetadata & { readonly userId: string }
    >({
      traceId: `trace_${params.runId}_search_${params.name}_${item.id}`,
      userId: params.userId,
      vector: queryVector,
      filter: { scenario: params.runId },
      topK: fullRankTopK
    });
    const rankIndex = ranked.findIndex((candidate) => candidate.id === item.id);
    const rank = rankIndex === -1 ? null : rankIndex + 1;
    const topCandidates = ranked.slice(0, 5).map((candidate) => ({
      id: candidate.id,
      score: Number(candidate.score.toFixed(6)),
      content: candidate.content,
      topic: candidate.metadata.topic
    }));
    results.push({
      id: item.id,
      topic: item.topic,
      query,
      expectedSentence: item.sentence,
      hitTopK: rank !== null && rank <= topK,
      rank,
      score: rank === null ? null : Number((ranked[rank - 1]?.score ?? 0).toFixed(6)),
      topCandidates,
      ...(rank !== null && rank <= topK ? {} : { likelyReason: analyzeMiss(item, topCandidates) })
    });
  }

  return {
    name: params.name,
    description: params.description,
    results,
    summary: summarize(results)
  };
};

const summarize = (results: readonly RecallResult[]) => {
  const total = results.length;
  const countAt = (limit: number): number =>
    results.filter((result) => result.rank !== null && result.rank <= limit).length;
  return {
    total,
    hitsAt1: countAt(1),
    hitsAt3: countAt(3),
    hitsAt5: countAt(5),
    hitsAt10: countAt(10),
    hitsAt20: countAt(20),
    hitsAtTopK: countAt(topK),
    foundWithinFullRank: results.filter((result) => result.rank !== null).length,
    recallAt1: Number((countAt(1) / total).toFixed(4)),
    recallAt3: Number((countAt(3) / total).toFixed(4)),
    recallAt5: Number((countAt(5) / total).toFixed(4)),
    recallAt10: Number((countAt(10) / total).toFixed(4)),
    recallAt20: Number((countAt(20) / total).toFixed(4)),
    recallAtTopK: Number((countAt(topK) / total).toFixed(4))
  };
};

const analyzeResults = (results: readonly RecallResult[]) => {
  const byTopic: Record<
    string,
    { total: number; hitsAt10: number; hitsAt20: number; worstRank: number }
  > = {};
  for (const result of results) {
    const bucket = (byTopic[result.topic] ??= {
      total: 0,
      hitsAt10: 0,
      hitsAt20: 0,
      worstRank: 0
    });
    bucket.total += 1;
    bucket.hitsAt10 += result.rank !== null && result.rank <= 10 ? 1 : 0;
    bucket.hitsAt20 += result.rank !== null && result.rank <= 20 ? 1 : 0;
    bucket.worstRank = Math.max(bucket.worstRank, result.rank ?? 9999);
  }

  return {
    missReasonCounts: countBy(
      results.filter((result) => !result.hitTopK).map((result) => result.likelyReason ?? "unknown")
    ),
    byTopic,
    repeatedTop1Candidates: topRepeatedCandidates(results, 1),
    repeatedTop5Candidates: topRepeatedCandidates(results, 5)
  };
};

const topRepeatedCandidates = (
  results: readonly RecallResult[],
  candidateLimit: number
): readonly {
  readonly id: string;
  readonly content: string;
  readonly topic: string | undefined;
  readonly count: number;
}[] => {
  const counts = new Map<
    string,
    {
      readonly id: string;
      readonly content: string;
      readonly topic: string | undefined;
      count: number;
    }
  >();
  for (const result of results) {
    for (const candidate of result.topCandidates.slice(0, candidateLimit)) {
      const current = counts.get(candidate.id) ?? {
        id: candidate.id,
        content: candidate.content,
        topic: candidate.topic,
        count: 0
      };
      current.count += 1;
      counts.set(candidate.id, current);
    }
  }
  return [...counts.values()].sort((left, right) => right.count - left.count).slice(0, 10);
};

const countBy = (values: readonly string[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
};

const compactOutput = (output: {
  readonly ok: boolean;
  readonly semantic_recall_ok: boolean;
  readonly duration_ms: number;
  readonly services: object;
  readonly ids: object;
  readonly scenarios: {
    readonly naturalQuestion: RecallScenario;
    readonly exactSentence: RecallScenario;
  };
  readonly analysis: ReturnType<typeof analyzeResults>;
  readonly misses: readonly RecallResult[];
  readonly worstRanks: readonly RecallResult[];
}) => ({
  ok: output.ok,
  semantic_recall_ok: output.semantic_recall_ok,
  duration_ms: output.duration_ms,
  services: output.services,
  ids: output.ids,
  summaries: {
    naturalQuestion: output.scenarios.naturalQuestion.summary,
    exactSentence: output.scenarios.exactSentence.summary
  },
  analysis: output.analysis,
  missCount: output.misses.length,
  missExamples: output.misses.slice(0, 10),
  worstRanks: output.worstRanks
});

const analyzeMiss = (item: RecallItem, topCandidates: RecallResult["topCandidates"]): string => {
  const sameTopicCount = topCandidates.filter((candidate) => candidate.topic === item.topic).length;
  if (sameTopicCount > 0) {
    return "top candidates share the same topic, but the embedding model ranked a sibling fact higher than the exact target";
  }
  const expectedTerms = new Set(tokenize(item.sentence));
  const queryTerms = new Set(tokenize(item.query));
  const overlap = [...expectedTerms].filter((term) => queryTerms.has(term));
  if (overlap.length <= 1) {
    return "query is a heavy paraphrase with little lexical overlap; the current embedding model may not bridge the wording gap";
  }
  return "target was indexed but ranked below topK; nearby candidates likely have stronger vector similarity for this query";
};

const tokenize = (text: string): readonly string[] =>
  text
    .replace(/[，。！？、；：,.!?;:]/gu, " ")
    .split(/\s+/u)
    .filter((part) => part.length >= 2);

const buildRecallItems = (): readonly RecallItem[] => {
  const topics = [
    {
      topic: "饮食偏好",
      facts: [
        ["喜欢早餐喝无糖豆浆。", "早餐饮料偏好是什么？"],
        ["不吃香菜，点餐时需要避开。", "点菜时有什么食材需要避开？"],
        ["喜欢微辣的川菜，但不能太油。", "川菜口味有什么要求？"],
        ["晚上九点后不喝咖啡。", "晚上咖啡因有什么限制？"],
        ["周末常做番茄牛腩。", "周末常做哪道家常菜？"],
        ["偏好低糖酸奶。", "酸奶有什么偏好？"],
        ["出差时会带燕麦棒当早餐。", "出差早餐通常准备什么？"],
        ["不喜欢奶茶里的珍珠。", "喝奶茶时不喜欢加什么？"],
        ["喜欢用空气炸锅做鸡翅。", "做鸡翅常用什么工具？"],
        ["每周三会提前准备沙拉。", "哪一天会准备沙拉？"]
      ]
    },
    {
      topic: "编程习惯",
      facts: [
        ["主要使用 Rust 写后端服务。", "后端服务主要用什么语言？"],
        ["提交前一定会运行 typecheck。", "提交代码前固定会跑什么检查？"],
        ["偏好用 Vitest 写 TypeScript 单测。", "TypeScript 单元测试偏好哪个框架？"],
        ["调试数据库问题时先看慢查询日志。", "数据库变慢时先检查什么？"],
        ["不喜欢在业务代码里使用 any。", "类型系统里避免使用什么？"],
        ["习惯用 rg 搜索代码。", "查找代码时常用什么命令？"],
        ["写接口前会先补 zod schema。", "写 API 前通常先补什么校验？"],
        ["喜欢小步提交，避免大重构混在一起。", "提交代码有什么节奏偏好？"],
        ["遇到 flaky test 会先固定随机种子。", "测试不稳定时会先做什么？"],
        ["review 时优先看隔离和幂等问题。", "代码评审最关注哪类风险？"]
      ]
    },
    {
      topic: "工作日程",
      facts: [
        ["每周一上午安排项目计划会。", "项目计划会通常什么时候？"],
        ["周二下午留给深度开发。", "哪段时间适合安排深度开发？"],
        ["周三晚上复盘技术债。", "什么时候复盘技术债？"],
        ["周四固定同步用户标签进展。", "用户标签进展在哪天同步？"],
        ["周五下午整理周报。", "周报通常什么时候写？"],
        ["每天早上九点半看告警面板。", "每天几点查看告警？"],
        ["午饭后不安排高强度会议。", "午饭后会议安排有什么限制？"],
        ["月底最后一天做成本检查。", "什么时候检查成本？"],
        ["上线前一天会留冻结窗口。", "上线前会预留什么窗口？"],
        ["每两周做一次依赖升级。", "依赖升级频率是多少？"]
      ]
    },
    {
      topic: "旅行偏好",
      facts: [
        ["订酒店时优先选择靠近地铁的地方。", "酒店位置有什么偏好？"],
        ["坐飞机喜欢靠过道座位。", "飞机座位偏好哪里？"],
        ["短途旅行只带双肩包。", "短途出行通常带什么包？"],
        ["不喜欢红眼航班。", "航班时间有什么避雷？"],
        ["去日本会优先买西瓜卡。", "去日本交通卡偏好什么？"],
        ["旅行时每天会留一小时散步。", "旅行日程会保留什么活动？"],
        ["海边城市更喜欢住安静街区。", "海边住宿区域有什么偏好？"],
        ["出门前会离线保存地图。", "出发前地图怎么准备？"],
        ["长途火车会带降噪耳机。", "坐长途火车会带什么设备？"],
        ["行程里不喜欢连续换酒店。", "住宿安排有什么不喜欢的模式？"]
      ]
    },
    {
      topic: "健康习惯",
      facts: [
        ["每天晚上十一点前睡觉。", "通常几点前睡觉？"],
        ["跑步时膝盖需要注意保护。", "运动时哪个部位要特别保护？"],
        ["每周游泳两次。", "游泳频率是多少？"],
        ["午后会做十分钟拉伸。", "下午会做什么放松活动？"],
        ["不喝含糖汽水。", "饮料健康限制是什么？"],
        ["久坐一小时会站起来活动。", "坐久了会怎么处理？"],
        ["冬天容易喉咙不舒服。", "冬天身体哪里容易不舒服？"],
        ["健身后会补充蛋白质。", "健身后会补充什么？"],
        ["睡前不用手机刷短视频。", "睡前避免什么习惯？"],
        ["周末早晨会去公园快走。", "周末早晨通常做什么运动？"]
      ]
    },
    {
      topic: "阅读学习",
      facts: [
        ["喜欢读系统设计类书籍。", "偏好哪类技术书？"],
        ["学习新框架时先看官方文档。", "学新框架第一步看什么？"],
        ["会把英文文章摘成中文要点。", "英文文章通常怎么整理？"],
        ["每月读一本非虚构书。", "非虚构书阅读频率是多少？"],
        ["不喜欢只看视频教程。", "学习材料有什么不偏好的形式？"],
        ["读论文时先看摘要和实验部分。", "论文阅读顺序怎么开始？"],
        ["会用卡片记录重要概念。", "重要概念怎么记录？"],
        ["周末上午适合学习数学。", "什么时候适合学数学？"],
        ["学习算法时会先手写例子。", "学算法会先做什么？"],
        ["技术分享后会整理行动项。", "听完技术分享会整理什么？"]
      ]
    },
    {
      topic: "项目状态",
      facts: [
        ["odd_agent 的 Memory 已改为 EmbeddingDb 事实源。", "Memory 现在用什么作为事实源？"],
        ["用户标签服务仍然使用 PostgreSQL。", "用户标签服务还依赖什么数据库？"],
        ["EmbeddingDb 推荐使用 Qdrant provider。", "EmbeddingDb 推荐哪种 provider？"],
        ["配置文件统一使用 odd-agent.yaml。", "运行时配置统一放在哪个文件？"],
        ["MemoryDiff prompt 放在 prompts 目录。", "MemoryDiff 的 prompt 文件在哪里？"],
        ["Qdrant 容器暴露在 6333 端口。", "Qdrant 本地端口是多少？"],
        ["日志需要脱敏 api key。", "日志里哪些敏感信息要处理？"],
        ["迁移脚本放在 db/migrations。", "数据库迁移脚本放在哪里？"],
        ["真实回归报告写入 tmp 目录。", "真实测试报告输出到哪里？"],
        ["Foundation 组件不直接读取散落环境变量。", "Foundation 组件不能直接读取什么配置来源？"]
      ]
    },
    {
      topic: "沟通偏好",
      facts: [
        ["回答希望先给结论再解释。", "回复结构有什么偏好？"],
        ["复杂问题喜欢分步骤说明。", "复杂问题希望怎么讲？"],
        ["不喜欢空泛的鼓励话术。", "沟通中不喜欢什么话术？"],
        ["中文回答要简洁自然。", "中文回复风格怎么要求？"],
        ["讨论代码时要给文件路径。", "讲代码变更时需要附什么？"],
        ["风险点要明确标出来。", "说明方案时风险怎么处理？"],
        ["如果测试没跑要直接说明。", "没执行测试时应该怎么反馈？"],
        ["不要把实现细节藏在总结里。", "总结里对实现细节有什么要求？"],
        ["遇到歧义先做合理假设。", "需求有歧义时优先怎么做？"],
        ["最终回复不要太长。", "最终回答长度有什么偏好？"]
      ]
    },
    {
      topic: "工具使用",
      facts: [
        ["搜索文件优先使用 rg。", "查文件内容优先用什么工具？"],
        ["修改代码优先使用 apply_patch。", "手工改文件应该优先用什么？"],
        ["前端验证需要看 Playwright 截图。", "前端改动怎么做视觉验证？"],
        ["长任务要定期汇报进展。", "耗时任务中应该怎么同步状态？"],
        ["真实凭据不能写入日志。", "凭据处理有什么禁忌？"],
        ["不要使用 git reset --hard。", "不能随便执行哪个危险 git 命令？"],
        ["运行测试前先确认服务容器状态。", "跑集成测试前要先看什么？"],
        ["外部文档需要优先看官方来源。", "查技术资料优先用什么来源？"],
        ["本地服务冲突时换端口。", "端口被占用时怎么办？"],
        ["提交信息要使用 Conventional Commits。", "commit message 应该遵循什么规范？"]
      ]
    },
    {
      topic: "个人偏好",
      facts: [
        ["喜欢深色编辑器主题。", "编辑器主题偏好什么？"],
        ["喜欢机械键盘的茶轴。", "键盘轴体偏好什么？"],
        ["工作时听低音量白噪声。", "工作背景音偏好什么？"],
        ["不喜欢桌面图标太多。", "桌面整理有什么偏好？"],
        ["周末喜欢逛书店。", "周末休闲喜欢做什么？"],
        ["喜欢简洁的任务清单。", "任务清单风格偏好什么？"],
        ["手机通知会保持精简。", "手机通知怎么设置？"],
        ["喜欢蓝色和绿色的界面点缀。", "界面点缀颜色偏好什么？"],
        ["不喜欢过度动画。", "界面动效有什么偏好？"],
        ["买电子产品前会看长期评测。", "买电子产品前会看什么？"]
      ]
    }
  ] as const;

  return topics.flatMap((topic, topicIndex) =>
    topic.facts.map(([sentence, query], factIndex) => ({
      id: `fact_${String(topicIndex + 1).padStart(2, "0")}_${String(factIndex + 1).padStart(2, "0")}`,
      topic: topic.topic,
      sentence: `${topic.topic}：${sentence}`,
      query
    }))
  );
};

const embedWithOllama = async (
  text: string,
  expectedDimension?: number
): Promise<readonly number[]> => {
  const response = await fetch(`${ollamaBaseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: ollamaEmbeddingModel, prompt: text })
  });
  if (!response.ok) {
    throw new Error(`ollama embedding failed: ${response.status} ${await response.text()}`);
  }
  const parsed = ollamaEmbeddingResponseSchema.parse(await response.json());
  if (expectedDimension !== undefined && parsed.embedding.length !== expectedDimension) {
    throw new Error(
      `embedding dimension mismatch: expected ${expectedDimension}, got ${parsed.embedding.length}`
    );
  }
  return parsed.embedding;
};

await main();
