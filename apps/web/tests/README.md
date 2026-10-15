# Oddfi 测试体系

## 结构

```
tests/
├── manual-checklist.md          人工测试清单
├── test-reports/                测试报告归档（自动编号 TR-NNN）
│   └── TR-001-xxx.md
├── scripts/
│   ├── smoke-test.sh            一键冒烟（含 5 步自动化检查）
│   └── console-check.mjs       浏览器控制台零报错检查（Playwright）
└── README.md                    本文件
```

## 分工

| 谁来测  | 怎么测                                 | 什么时候跑                            |
| ------- | -------------------------------------- | ------------------------------------- |
| AI / CI | `pnpm test`                            | 每次提交 (pre-commit hook)            |
| AI / CI | `pnpm type-check` + `pnpm build`       | 每次 push (pre-push hook)             |
| AI / CI | `bash tests/scripts/smoke-test.sh`     | 部署前 / 升级后                       |
| AI / CI | `node tests/scripts/console-check.mjs` | 部署前 / 升级后（含在 smoke-test 中） |
| **人**  | **`tests/manual-checklist.md`**        | **升级 / 重构 / 部署前**              |

## 自动化冒烟包含的 5 步

1. `pnpm build` — 编译检查
2. `pnpm type-check` — 类型检查
3. `pnpm test` — 单元/集成测试
4. 逐页 HTTP 200 — 页面可达性
5. **浏览器 console.error 检查** — Playwright 无头浏览器逐页检查运行时报错

## 单独运行 console 检查

```bash
# 先启动 dev server
pnpm dev &
# 运行检查（默认 port 3000）
node tests/scripts/console-check.mjs 3000
```

## 测试报告规范

AI Agent 每次完成测试后，自动输出报告到 `test-reports/`：

- 编号: `TR-NNN-<简述>.md`（三位数字递增）
- 必含字段: 测试时间、测试分支、基线 commit、测试 commit、执行者、自动化结果表、缺陷表、结论
- 查找最新编号: `ls test-reports/TR-*.md | tail -1`

## 维护规则

- 新增页面 → 更新 `smoke-test.sh` 的 PAGES 数组 + `console-check.mjs` 的 PAGES 数组
- 新增已知第三方噪音 → 更新 `console-check.mjs` 的 IGNORED_PATTERNS
- 新增人工验证场景 → 更新 `manual-checklist.md` 对应章节
- 测试完成 → 自动输出 `test-reports/TR-NNN-xxx.md`
