// dataProvider：信封拆包 + 按 resource 适配分页参数。
// Refine 的 @refinedev/simple-rest 不认 {code,message,data} 信封，必须自定义。
// 契约：02-data-layer.md §3。
import type { BaseRecord, DataProvider } from "@refinedev/core";
import { api, unwrap } from "@/lib/api";

// 分页参数名差异：admin-users / events 用 page/page_size；presale 资源用 page/size。
const PAGE_PARAM: Record<string, { page: string; size: string }> = {
  "admin-users": { page: "page", size: "page_size" },
  events: { page: "page", size: "page_size" },
};
const pageKeyOf = (r: string) => PAGE_PARAM[r] ?? { page: "page", size: "size" };

// resource → 后端路径段。
const PATH: Record<string, string> = {
  rounds: "admin/presale/rounds",
  deposits: "admin/presale/deposits",
  anomaly: "admin/presale/anomaly",
  "kol-referral": "admin/presale/kol-referral",
  audit: "admin/presale/audit",
  "admin-users": "admin/admin-users",
  // 赛事风险列表（DD002）。detail/adjust-history/decision 走 useCustom，不经 getList。
  events: "admin/events/risk/list",
};

function pathOf(resource: string): string {
  const p = PATH[resource];
  if (!p) throw new Error(`[dataProvider] unknown resource — ${resource}`);
  return p;
}

const API_URL = import.meta.env.VITE_API_BASE ?? "/";

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(params: {
    resource: string;
    pagination?: { currentPage?: number; pageSize?: number; mode?: "off" | "server" | "client" };
    filters?: { field?: string; value?: unknown; operator?: string }[];
    sorters?: { field: string; order: "asc" | "desc" }[];
  }) => {
    const { resource, pagination, filters, sorters } = params;
    // ⚠️ Refine 6 的 Pagination 字段是 currentPage（不是 current）；用错会永远停在第 1 页。
    const { currentPage = 1, pageSize = 20 } = pagination ?? {};
    const pk = pageKeyOf(resource);
    const searchParams = new URLSearchParams();
    // rounds 返回全部 6 轮、不分页 → 不传分页参数。
    if (resource !== "rounds") {
      searchParams.set(pk.page, String(currentPage));
      searchParams.set(pk.size, String(pageSize));
    }
    // filters → query（round_id / status / operator / action / from_ts / to_ts ...）
    // 多值 filter（如 events 的 signal=orange,red）= 逗号 join 后 set 单 key——
    // 后端契约为逗号多值（RawQuery 透传 + web-api 按逗号 split），不用重复 query key。
    for (const f of filters ?? []) {
      if (!f.field || f.value == null || f.value === "") continue;
      if (Array.isArray(f.value)) {
        if (f.value.length === 0) continue;
        searchParams.set(f.field, f.value.map(String).join(","));
      } else {
        searchParams.set(f.field, String(f.value));
      }
    }
    // sorters → sort_by/sort_order（events 契约；单列排序，取第一项）
    const sorter = sorters?.[0];
    if (sorter) {
      searchParams.set("sort_by", sorter.field);
      searchParams.set("sort_order", sorter.order);
    }
    const data = await unwrap<{ list: TData[]; total: number }>(
      api.get(pathOf(resource), { searchParams }),
    );
    return { data: data.list, total: data.total };
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(params: {
    resource: string;
    id?: string | number;
  }) => {
    const { resource, id } = params;
    // rounds/:id、anomaly/:id、deposits/:txHash（id 即 txHash）。id 编码防特殊字符破坏 URL。
    const data = await unwrap<TData>(api.get(`${pathOf(resource)}/${encodeURIComponent(String(id))}`));
    return { data };
  },

  // admin-users create（POST）；其它 presale 资源无 create。
  create: async <TData extends BaseRecord = BaseRecord, TVariables = unknown>(params: {
    resource: string;
    variables: TVariables;
  }) => {
    const { resource, variables } = params;
    const data = await unwrap<TData>(api.post(pathOf(resource), { json: variables }));
    return { data };
  },

  // admin-users delete（DELETE /:lark_user_id）。
  deleteOne: async <TData extends BaseRecord = BaseRecord>(params: {
    resource: string;
    id?: string | number;
  }) => {
    const { resource, id } = params;
    const data = await unwrap<TData>(
      api.delete(`${pathOf(resource)}/${encodeURIComponent(String(id))}`),
    );
    return { data };
  },

  // 所有非 CRUD mutation（状态机/migrate/resolve/config/role）走 custom（M2 hooks 消费）。
  // 支持 post/patch + 自定义 headers（X-Idempotency-Key 由调用方按 form 生命周期传入）。
  // useCustom 的 config.query 由 Refine 摊平成顶层 query → 这里转 searchParams（H-Code-1：
  // 漏接会导致 adjust-history 的 market/direction 等 GET 参数被静默丢弃）。
  custom: async <TData extends BaseRecord = BaseRecord, TPayload = unknown>(params: {
    url: string;
    method: "get" | "delete" | "head" | "options" | "post" | "put" | "patch";
    payload?: TPayload;
    query?: Record<string, unknown>;
    headers?: Record<string, string>;
  }) => {
    const { url, method, payload, query, headers } = params;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v != null && v !== "") sp.set(k, String(v));
    }
    const searchParams = sp.size > 0 ? sp : undefined;
    let promise: Promise<Response>;
    switch (method) {
      case "post":
        promise = api.post(url, { json: payload, headers, searchParams });
        break;
      case "patch":
        promise = api.patch(url, { json: payload, headers, searchParams });
        break;
      case "put":
        promise = api.put(url, { json: payload, headers, searchParams });
        break;
      case "delete":
        promise = api.delete(url, { headers, searchParams });
        break;
      case "get":
        promise = api.get(url, { headers, searchParams });
        break;
      default:
        throw new Error(`[dataProvider] unsupported custom method — ${method}`);
    }
    const data = await unwrap<TData>(promise);
    return { data };
  },

  getApiUrl: () => API_URL,

  // presale mutation 一律走 useCustomMutation，update/getMany 等不使用。
  update: async () => {
    throw new Error("[dataProvider] use useCustomMutation for presale mutations");
  },
} as DataProvider;
