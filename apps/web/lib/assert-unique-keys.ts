/**
 * Dev-only 重复 key 检测工具。
 *
 * 背景：ENH-030。React key 用业务字段（如 odds lineValue、team name）做唯一标识时，
 * 若上游数据契约违规（同 lineValue 多条目、同 name 多 ID 等），React 会触发
 * `Encountered two children with the same key` 警告，prod 静默错乱。
 *
 * 用法：在数据归并/去重出口处调用，dev 模式下打 warning 反推上游契约违规。
 * Prod build 通过 `process.env.NODE_ENV` 守卫自动 no-op，无运行时开销。
 *
 * @example
 *   const lines = parseOddsLines(odds);
 *   assertUniqueKeys(lines, (l) => l.lineValue, "parseOddsLines");
 */
export function assertUniqueKeys<T>(
  arr: readonly T[],
  getKey: (item: T) => string,
  label: string
): void {
  if (process.env.NODE_ENV !== "development") return;

  const counts = new Map<string, number>();
  for (const item of arr) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of counts) {
    if (count > 1) {
      console.warn(
        `[${label}] duplicate key "${key}" appears ${count}x — upstream data contract violation`
      );
    }
  }
}
