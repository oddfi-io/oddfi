import { describe, it, expect } from "vitest";
import { toSearchParams } from "./searchParams";

describe("toSearchParams", () => {
  it("undefined 入参返回 undefined", () => {
    expect(toSearchParams(undefined)).toBeUndefined();
  });

  it("空对象返回 undefined", () => {
    expect(toSearchParams({})).toBeUndefined();
  });

  it("过滤 undefined / null / 空串", () => {
    expect(
      toSearchParams({
        tab: "active",
        search: "",
        begin_date: undefined,
      })
    ).toEqual({ tab: "active" });
  });

  it("保留数字 0（合法值）", () => {
    expect(toSearchParams({ page: 0, page_size: 20 })).toEqual({ page: 0, page_size: 20 });
  });

  it("保留多字段混合", () => {
    expect(
      toSearchParams({
        tab: "settled",
        type: "bet_won",
        page: 2,
        page_size: 20,
        sort: "desc",
      })
    ).toEqual({
      tab: "settled",
      type: "bet_won",
      page: 2,
      page_size: 20,
      sort: "desc",
    });
  });
});
