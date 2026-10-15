import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/types/api";

// ── Hoist mocks BEFORE vi.mock factories run ──────────────────────────────────
const { mockUnwrap, mockApiGet } = vi.hoisted(() => ({
  mockUnwrap: vi.fn(),
  mockApiGet: vi.fn(() => Promise.resolve(new Response("{}"))),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: mockApiGet,
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  unwrap: mockUnwrap,
}));

// Import AFTER mocking
import { dataProvider } from "./dataProvider";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helper: extract URLSearchParams from the first api.get call ───────────────
function getCallSearchParams(): URLSearchParams {
  const call = mockApiGet.mock.calls[0] as unknown as [string, { searchParams: URLSearchParams }];
  return call[1].searchParams;
}

// ── Envelope helpers ──────────────────────────────────────────────────────────

function envelopeSuccess<T>(data: T) {
  return Promise.resolve(data);
}

function envelopeError(code: string, message: string) {
  return Promise.reject(new ApiError(code, 200, message));
}

// ── getList: envelope unwrap ──────────────────────────────────────────────────

describe("dataProvider.getList — envelope", () => {
  it("returns data.list and data.total when code === 0", async () => {
    mockUnwrap.mockImplementationOnce(() =>
      envelopeSuccess({ list: [{ id: 1 }], total: 42 }),
    );
    const result = await dataProvider.getList!({
      resource: "deposits",
      pagination: { currentPage: 1, pageSize: 20 },
    });
    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.total).toBe(42);
  });

  it("propagates ApiError when code !== 0", async () => {
    mockUnwrap.mockImplementationOnce(() =>
      envelopeError("FORBIDDEN", "insufficient role"),
    );
    await expect(
      dataProvider.getList!({ resource: "deposits" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("ApiError carries errorCode from backend code string", async () => {
    mockUnwrap.mockImplementationOnce(() =>
      envelopeError("VALIDATION_FAILED", "bad input"),
    );
    await expect(
      dataProvider.getList!({ resource: "deposits" }),
    ).rejects.toMatchObject({ errorCode: "VALIDATION_FAILED" });
  });
});

// ── getList: pagination params per resource ───────────────────────────────────

describe("dataProvider.getList — pagination params", () => {
  beforeEach(() => {
    mockUnwrap.mockResolvedValue({ list: [], total: 0 });
  });

  it("deposits: sends page + size params", async () => {
    await dataProvider.getList!({
      resource: "deposits",
      pagination: { currentPage: 2, pageSize: 10 },
    });
    const sp = getCallSearchParams();
    expect(sp.get("page")).toBe("2");
    expect(sp.get("size")).toBe("10");
  });

  it("anomaly: sends page + size params", async () => {
    await dataProvider.getList!({
      resource: "anomaly",
      pagination: { currentPage: 3, pageSize: 50 },
    });
    const sp = getCallSearchParams();
    expect(sp.get("page")).toBe("3");
    expect(sp.get("size")).toBe("50");
  });

  it("audit: sends page + size params", async () => {
    await dataProvider.getList!({
      resource: "audit",
      pagination: { currentPage: 1, pageSize: 20 },
    });
    const sp = getCallSearchParams();
    expect(sp.get("page")).toBe("1");
    expect(sp.get("size")).toBe("20");
  });

  it("kol-referral: sends page + size params + 走 admin/presale/kol-referral 路径", async () => {
    await dataProvider.getList!({
      resource: "kol-referral",
      pagination: { currentPage: 2, pageSize: 20 },
    });
    const call = mockApiGet.mock.calls[0] as unknown as [string, { searchParams: URLSearchParams }];
    expect(call[0]).toBe("admin/presale/kol-referral");
    const sp = call[1].searchParams;
    expect(sp.get("page")).toBe("2");
    expect(sp.get("size")).toBe("20");
  });

  it("admin-users: sends page + page_size (not size)", async () => {
    await dataProvider.getList!({
      resource: "admin-users",
      pagination: { currentPage: 1, pageSize: 20 },
    });
    const sp = getCallSearchParams();
    expect(sp.get("page")).toBe("1");
    expect(sp.get("page_size")).toBe("20");
    expect(sp.has("size")).toBe(false);
  });

  it("events: sends page + page_size + 走 admin/events/risk/list 路径", async () => {
    await dataProvider.getList!({
      resource: "events",
      pagination: { currentPage: 2, pageSize: 20 },
    });
    const call = mockApiGet.mock.calls[0] as unknown as [string, { searchParams: URLSearchParams }];
    expect(call[0]).toBe("admin/events/risk/list");
    const sp = call[1].searchParams;
    expect(sp.get("page")).toBe("2");
    expect(sp.get("page_size")).toBe("20");
    expect(sp.has("size")).toBe(false);
  });

  it("rounds: does NOT send any pagination params", async () => {
    await dataProvider.getList!({
      resource: "rounds",
      pagination: { currentPage: 2, pageSize: 20 },
    });
    const sp = getCallSearchParams();
    expect(sp.has("page")).toBe(false);
    expect(sp.has("size")).toBe(false);
    expect(sp.has("page_size")).toBe(false);
  });

  it("uses default currentPage=1 pageSize=20 when pagination is undefined", async () => {
    await dataProvider.getList!({ resource: "deposits" });
    const sp = getCallSearchParams();
    expect(sp.get("page")).toBe("1");
    expect(sp.get("size")).toBe("20");
  });

  it("throws for an unknown resource", async () => {
    await expect(
      dataProvider.getList!({ resource: "unicorn" }),
    ).rejects.toThrow("[dataProvider] unknown resource — unicorn");
  });
});

// ── getList: filter passthrough ───────────────────────────────────────────────

describe("dataProvider.getList — filters", () => {
  beforeEach(() => {
    mockUnwrap.mockResolvedValue({ list: [], total: 0 });
  });

  it("appends non-empty filter fields to searchParams", async () => {
    await dataProvider.getList!({
      resource: "deposits",
      filters: [
        { field: "status", value: "pending", operator: "eq" },
        { field: "round_id", value: 3, operator: "eq" },
      ],
    });
    const sp = getCallSearchParams();
    expect(sp.get("status")).toBe("pending");
    expect(sp.get("round_id")).toBe("3");
  });

  it("skips filters with null/empty values", async () => {
    await dataProvider.getList!({
      resource: "deposits",
      filters: [
        { field: "status", value: null, operator: "eq" },
        { field: "round_id", value: "", operator: "eq" },
      ],
    });
    const sp = getCallSearchParams();
    expect(sp.has("status")).toBe(false);
    expect(sp.has("round_id")).toBe(false);
  });

  // DD002：多值 filter = 逗号 join 单 key（?signal=orange,red），不重复 query key
  it("joins array filter values with comma into a single key (events signal)", async () => {
    await dataProvider.getList!({
      resource: "events",
      filters: [{ field: "signal", value: ["orange", "red"], operator: "in" }],
    });
    const sp = getCallSearchParams();
    expect(sp.get("signal")).toBe("orange,red");
    expect(sp.getAll("signal")).toHaveLength(1);
  });

  it("skips empty array filter values", async () => {
    await dataProvider.getList!({
      resource: "events",
      filters: [{ field: "signal", value: [], operator: "in" }],
    });
    const sp = getCallSearchParams();
    expect(sp.has("signal")).toBe(false);
  });
});

// ── getList: sorters → sort_by/sort_order ────────────────────────────────────

describe("dataProvider.getList — sorters", () => {
  beforeEach(() => {
    mockUnwrap.mockResolvedValue({ list: [], total: 0 });
  });

  it("maps the first sorter to sort_by/sort_order", async () => {
    await dataProvider.getList!({
      resource: "events",
      sorters: [{ field: "max_exposure", order: "desc" }],
    });
    const sp = getCallSearchParams();
    expect(sp.get("sort_by")).toBe("max_exposure");
    expect(sp.get("sort_order")).toBe("desc");
  });

  it("omits sort params when sorters is empty", async () => {
    await dataProvider.getList!({ resource: "events", sorters: [] });
    const sp = getCallSearchParams();
    expect(sp.has("sort_by")).toBe(false);
    expect(sp.has("sort_order")).toBe(false);
  });
});

// ── custom: config.query → searchParams（H-Code-1 回归）─────────────────────

describe("dataProvider.custom — query params", () => {
  beforeEach(() => {
    mockUnwrap.mockResolvedValue({});
  });

  it("forwards query object to GET searchParams (adjust-history market/direction)", async () => {
    await dataProvider.custom!({
      url: "admin/events/5/adjust-history",
      method: "get",
      query: { market: "胜负", direction: "主胜" },
    });
    const call = mockApiGet.mock.calls[0] as unknown as [
      string,
      { searchParams?: URLSearchParams },
    ];
    expect(call[0]).toBe("admin/events/5/adjust-history");
    expect(call[1].searchParams?.get("market")).toBe("胜负");
    expect(call[1].searchParams?.get("direction")).toBe("主胜");
  });

  it("skips null/empty query values and omits searchParams when all empty", async () => {
    await dataProvider.custom!({
      url: "admin/approval/counts",
      method: "get",
      query: { a: null, b: "" },
    });
    const call = mockApiGet.mock.calls[0] as unknown as [
      string,
      { searchParams?: URLSearchParams },
    ];
    expect(call[1].searchParams).toBeUndefined();
  });
});
