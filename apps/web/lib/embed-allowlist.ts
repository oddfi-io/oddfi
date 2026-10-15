/**
 * ENH embed-allowlist-sot：直播 embed 域白名单单一真值源（前端侧消费）。
 *
 * 背景：streamed.pk 反复轮换 embed 域（embedme.top→embedsports.top→embed.st），
 * 过去每次轮换要改 3 处 2 仓（spider 白名单 + web-api 白名单 + 前端 CSP frame-src）。
 * 本模块让前端 CSP 的「直播域」部分运行时从后端单一真值源拉取（market-api 的
 * GET /api/v1/stream/embed-allowlist），后端改一处 STREAM_EMBED_ALLOWED_HOSTS env，
 * 前端 CSP 在 TTL 内自动跟随，无需前端发版。middleware.ts 用 buildFrameSrc() 设 CSP。
 *
 * 安全：① 拉到的 host 必须过严格 DNS 名校验才注入 CSP（纵深防御，即便后端可信）；
 *       ② 端点不可达/非法时回退「上次缓存→baked 默认」，绝不回退到空或 '*'
 *         （空=直播被拦，'*'=iframe sink 洞开）。
 */

// frame-src 稳定段（self + 钱包 provider），不随 streamed.pk 轮换，与 next.config.mjs 历史值一致。
const STATIC_FRAME_SRC = [
  "'self'",
  "https://*.walletconnect.com",
  "https://*.walletconnect.org",
  "https://metamask.app.link",
  "https://*.coinbase.com",
];

// baked 兜底直播域：仅当后端白名单端点不可达且无缓存时使用。永不回退到空 / '*'。
// 与后端 stream_url_filter.go / stream_svc.go 默认 allowlist 一致。
const BAKED_STREAM_HOSTS = ["embedme.top", "embedsports.top", "embed.st"];

const TTL_MS = 5 * 60 * 1000; // 5 分钟缓存，轮换在此 TTL 内自动生效
const FETCH_TIMEOUT_MS = 2000;

// 严格 DNS 名：小写字母数字 + 连字符的多段域名，无端口/路径/协议/通配。
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

let cache: { hosts: string[]; at: number } | null = null;

const MAX_HOSTS = 64; // 数量上限，防恶意/畸形后端返回超多 host 撑大 CSP 头（REV-B Mn1）
const MAX_HOST_LEN = 253; // 单 host 长度上限（DNS 名上限）

async function fetchStreamHosts(): Promise<string[] | null> {
  // MARKET_API_URL 缺失 → 返回 null 安全降级到 baked（CSP 仍含 embed.st 可用），
  // 不硬编码跨环境 prod URL（避免 dev 漏配时静默打到 prod）。env 文件实际均已配（REV-A Minor-4）。
  const base = process.env.MARKET_API_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/stream/embed-allowlist`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store", // 自管 TTL，绕开 Next fetch 缓存
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const hosts = (json as { data?: { hosts?: unknown } })?.data?.hosts;
    if (!Array.isArray(hosts) || hosts.length === 0) return null;
    const clean = hosts
      .filter(
        (h): h is string => typeof h === "string" && h.length <= MAX_HOST_LEN && HOST_RE.test(h)
      )
      .slice(0, MAX_HOSTS);
    return clean.length > 0 ? clean : null;
  } catch {
    return null;
  }
}

// in-flight 去重：TTL 边界/冷启动多个并发请求只触发一次 fetch，避免惊群各卡 2s（REV-A Minor-1）。
let inflight: Promise<string[] | null> | null = null;

/** 返回当前生效的直播 embed 域（缓存优先；失败回退缓存→baked，永不空）。 */
export async function getStreamFrameHosts(): Promise<string[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.hosts;

  if (!inflight) {
    inflight = fetchStreamHosts().finally(() => {
      inflight = null;
    });
  }
  const fetched = await inflight;
  if (fetched) {
    cache = { hosts: fetched, at: Date.now() };
    return fetched;
  }
  if (cache) return cache.hosts; // 端点暂时不可达 → 用上次已知值
  return BAKED_STREAM_HOSTS; // 冷启动且端点不可达 → baked 兜底
}

/** 组装完整 CSP frame-src 值（稳定段 + 动态直播段）。 */
export async function buildFrameSrc(): Promise<string> {
  // 保留 env 逃生通道：显式指定时原样直接用（运维可临时硬覆盖直播段）。
  // ⚠️ override 为运维信任输入（build-time NEXT_PUBLIC，非用户输入、不可运行时翻转），刻意跳过 HOST_RE 校验（REV Mn2）。
  const override = process.env.NEXT_PUBLIC_STREAM_FRAME_SRC?.trim();
  const streamSrc = override
    ? override
    : (await getStreamFrameHosts()).map((h) => `https://${h}`).join(" ");
  return [...STATIC_FRAME_SRC, streamSrc].filter(Boolean).join(" ");
}
