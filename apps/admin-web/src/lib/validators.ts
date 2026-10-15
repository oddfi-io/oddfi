// AntD Form validator helpers。不引 zod（校验逻辑简单，用 AntD 原生 rules + 小 helper）。
// 契约：00-architecture.md §1，02-data-layer.md §4.4（NOTE_REQUIRED note≥10）。
import type { Rule } from "antd/es/form";
import { isValidDecimal } from "@/lib/amount";

// 备注 ≥10 字符，按 rune 计数（[...s].length 正确处理 emoji / 代理对）。
// 后端 noteValidatorMW 落 NOTE_REQUIRED(400)，前端先拦。
export function noteRule(minRunes = 10): Rule {
  return {
    validator: (_rule, value: string) => {
      const len = value ? [...value].length : 0;
      if (len >= minRunes) return Promise.resolve();
      return Promise.reject(new Error(`操作备注至少 ${minRunes} 个字符`));
    },
  };
}

// 合法 decimal 字符串校验（金额字段不转 number，保留 string）。
export function decimalRule(options?: { required?: boolean; label?: string }): Rule {
  const { required = false, label = "金额" } = options ?? {};
  return {
    validator: (_rule, value: string) => {
      if (value == null || value === "") {
        return required ? Promise.reject(new Error(`请输入${label}`)) : Promise.resolve();
      }
      if (isValidDecimal(value)) return Promise.resolve();
      return Promise.reject(new Error(`${label}格式非法，请输入合法数字`));
    },
  };
}
