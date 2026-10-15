# Stop Persistent Hook 回滚 SOP

> 出问题时直接按场景找对应命令执行，不需要重新理解。

**Hook 文件**：`.claude/hooks/stop-persistent.mjs`
**配置位置**：`.claude/settings.json` → `hooks.Stop`
**首版 commit**：`cc5c322 chore(hooks): 新增 Stop hook 防止 AI 回合自动停止`
**触发条件**：`.omc/active-task.flag` 存在时拦截 Stop 信号

---

## 场景速查表

| 症状                                  | 严重度 | 用 L? |
| ------------------------------------- | ------ | ----- |
| AI 一直跑停不下来，但任务已完成       | 低     | L1    |
| AI 卡在同一个失败操作循环             | 中     | L2    |
| 某次会话彻底失控（hook 自身行为异常） | 中     | L3    |
| 想在自己电脑暂时关掉，不影响团队      | 低     | L4    |
| Hook 设计有问题需要团队级关掉         | 高     | L5    |
| 完全恢复到引入 hook 之前              | 高     | L6    |

---

## L1 · 临时静默（最常用）

任务做完了 AI 还在续——多半是忘了删 flag。

```bash
rm -f .omc/active-task.flag .omc/active-task.flag.count
```

flag 不存在时 hook 立即放行，下一次 Stop 即恢复默认行为。**无副作用**。

---

## L2 · 紧急刹车（AI 卡死循环）

AI 在重试同一个失败操作（典型：Edit 反复报 `File has been modified since read`），希望立刻停下来。

```bash
touch .progress/stash/abort.flag
```

hook 检测到 `abort.flag` 即放行，无视 active-task.flag。AI 下个回合自然结束，控制权回到你手里。

完事记得清理：

```bash
rm -f .progress/stash/abort.flag .omc/active-task.flag .omc/active-task.flag.count
```

---

## L3 · 单会话失控（Hook 自身异常）

hook 输出格式错误、脚本崩了、或某种你看不懂的卡死。

**步骤 1**：在 Claude Code 终端按 `Ctrl+C` 中断当前 turn。
**步骤 2**：清掉所有触发条件：

```bash
rm -f .omc/active-task.flag .omc/active-task.flag.count .progress/stash/abort.flag
```

**步骤 3**：手动测一下 hook 是否还能正常返回：

```bash
echo '{"cwd":"'$PWD'","stop_reason":"end_turn"}' | node .claude/hooks/stop-persistent.mjs
# 期望输出：{"continue":true,"suppressOutput":true}
```

输出异常 → 走 L4 / L5。

---

## L4 · 个人电脑暂时禁用（不影响团队）

仅在本机关掉 hook，不动入库的 `.claude/settings.json`。

**方式 A**：把 hook 文件改成立即放行（最稳）

```bash
cat > .claude/hooks/stop-persistent.mjs <<'EOF'
#!/usr/bin/env node
console.log(JSON.stringify({ continue: true, suppressOutput: true }));
EOF
```

注意 `.claude/hooks/stop-persistent.mjs` 是入库的，本地改动会出现在 `git status`，**不要 commit**。

**方式 B**：用 `.claude/settings.local.json`（不入库）覆盖

```bash
# 在 .claude/settings.local.json 里加 Stop:[] 空数组
# 注意：Claude Code 对同名 hook 字段是合并而非覆盖，本方式可能无效，优先用方式 A
```

恢复：`git checkout .claude/hooks/stop-persistent.mjs`

---

## L5 · 团队级关闭（保留代码，停用 hook）

Hook 设计有缺陷需要紧急停用，但保留文件避免大量 diff。

**操作**：编辑 `.claude/settings.json`，删除 `Stop` 整段：

```diff
     ],
-    "Stop": [
-      {
-        "hooks": [
-          {
-            "type": "command",
-            "command": "node .claude/hooks/stop-persistent.mjs"
-          }
-        ]
-      }
-    ]
   },
```

提交：

```bash
git checkout -b hotfix/disable-stop-hook
git add .claude/settings.json
git commit -m "hotfix: 临时停用 Stop hook (待修复后恢复)"
git push origin hotfix/disable-stop-hook
# 走正常 PR 流程合并到 main
```

---

## L6 · 完全回滚（删除所有改动）

把 hook、配置、CLAUDE.md 规则全部撤回到引入前状态。

**情况 A**：还没 merge 进 main（分支 `chore/persistent-stop-hook` 还在）

```bash
git checkout main
git branch -D chore/persistent-stop-hook
# 远程已推：git push origin --delete chore/persistent-stop-hook
```

**情况 B**：已 merge 进 main，用 revert

```bash
git checkout main && git pull
git revert cc5c322  # 首版 commit hash
git push origin main
# 团队同步：git pull
```

**情况 C**：已 merge 多次迭代，需手动清理

```bash
# 1. 删 hook 文件
git rm .claude/hooks/stop-persistent.mjs

# 2. 改 .claude/settings.json，删除 Stop 整段（同 L5）

# 3. 改 CLAUDE.md，删除"持续模式 Stop hook"和"团队协作前置"两条规则

# 4. 提交
git add -A
git commit -m "chore: 回滚 Stop persistent hook"
```

---

## 验证回滚是否生效

回滚后跑一次 hook 验证：

```bash
# 期望 1：无 flag 时 → continue
echo "{\"cwd\":\"$PWD\",\"stop_reason\":\"end_turn\"}" | node .claude/hooks/stop-persistent.mjs 2>/dev/null \
  || echo "hook 文件已删除（L6 情况）"

# 期望 2：有 flag 时（L1/L2/L3 应该清干净了）
ls -la .omc/active-task.flag* .progress/stash/abort.flag 2>/dev/null \
  && echo "❌ 还有残留 flag，请清理" \
  || echo "✅ 无残留 flag"
```

---

## 排错速查

| 现象                              | 可能原因                       | 处理                                                                 |
| --------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| `rm flag` 后 AI 还在续            | flag.count 还在                | `rm -f .omc/active-task.flag*`（带 glob）                            |
| `abort.flag` 不生效               | 路径错（写到 worktree 里了）   | hook 用 stdin 的 cwd 字段，确认 cwd 与 flag 路径一致                 |
| Stop hook 报 `Cannot find module` | Node 版本太旧不支持 ESM import | 升级到 Node 18+                                                      |
| `git status` 显示 hook 文件被改   | L4 方式 A 改过本地版本         | 不要 commit；恢复用 `git checkout .claude/hooks/stop-persistent.mjs` |
| Pre-commit 卡在 lint-staged       | 与 hook 无关，是 husky 钩子    | 跟本 SOP 无关，参考 `.husky/pre-commit`                              |

---

## 升级 / 迁移注意

- Hook 内部续杯上限 `MAX = 30`，需调整改 `.claude/hooks/stop-persistent.mjs:26`
- 豁免关键词列表在该文件第 16-17 行的 `EXEMPT` 正则，加新关键词时同步更新
- 与 OMC 全局 `persistent-mode.mjs` 共存，两者并行触发，**任一 block 即生效**
