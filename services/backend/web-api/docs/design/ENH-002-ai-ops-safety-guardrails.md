# ENH-002: AI 操作 prod 的轻量级护栏

**状态**：DRAFT — 等用户 APPROVED 后由 dev agent 实施
**日期**：2026-05-27（dev 实施开始日另注）
**作者**：DD-INVEST cutover 执行人 + Claude AI orchestrator
**关联事故**：[INC-001](../incidents/INC-001-2026-05-26-rds-admin-password-rotation-broke-testnet.md)
**关联记忆**：`feedback_verify_before_claim.md` / `feedback_docker_deploy_arch.md`

---

## 1. 背景与触发

### 1.1 触发事件

2026-05-26 DD-003 cutover 收尾期间，Claude AI 执行 `ALTER USER 'admin'@'%' IDENTIFIED BY <NEW>` 旋转 RDS 主用户密码。该用户被**所有服务共享**（架构债），密码改完后 prod / dev / testnet 多个服务集体认证失败（1045 access denied）。回滚 + 同步配置耗时 ~30 min，期间 testnet 数据展示部分不可用。

详见 [INC-001](../incidents/INC-001-2026-05-26-rds-admin-password-rotation-broke-testnet.md)。

### 1.2 根因（与本 ENH 直接相关的）

AI 在执行**不可逆 / 大爆炸半径**操作前没有：

1. 主动盘点哪些服务会受影响（VPC 横扫 EC2 / configs / connection pool）
2. 检查历史事故是否有类似教训（pattern matching）
3. 显式向用户披露爆炸半径并等待 confirm

ChatOps 默认行为是「用户授权就执行」。但用户授权时往往不知道全部影响范围，AI 比用户更接近事实却没主动提醒。这是 AI agent 跑 prod 命令的**共性问题**，业界 2024-2025 年才开始有共识。

### 1.3 现有基建评估

| 项 | 现状 |
|---|---|
| `.claude/rules/*.md` 规则文件 | 8 个已落库，但**无 infra-ops 安全规则** |
| `.claude/settings.json` hook | 已有 `PreToolUse:Bash → guard-bash.sh`（拦截力度未知），无 RED 模式拦截 |
| OMC sub-agent | 已有 critic / explore / executor / verifier 等，**无 impact-analyst / incident-matcher** |
| `web-api/docs/incidents/` | 1 篇 INC-001 已落档，无 tag 索引 |
| `web-api/docs/infra/shared-resources-map.md` | INC-001 后 Agent 实地盘点已落档（爆炸半径源真值） |
| memory `feedback_verify_before_claim` | 已沉淀「先实测再断言」原则，但无机制强制执行 |

详见 Agent 调研报告（本次方案前置工作产物，未落库）。

---

## 2. 目标 / 非目标

### 2.1 目标

1. **AI 跑 RED 级 prod 操作前必须先做爆炸半径评估 + 事故关联检索**
2. **机制 ≤ 30 分钟落地**，认知成本低
3. **不引入新工具**（不要 Datadog / Terraform / k8s）
4. **不增加 GREEN 操作的延迟**（避免疲劳）
5. **emergency 通道存在**，紧急回滚不被 ritual 拖累

### 2.2 非目标

- 不做正式 Change Advisory Board（小团队 < 10 人不需要）
- 不做 PR-based approval（已有 GitHub branch protection 即可）
- 不做全链路 tracing（暂不接 Datadog/Jaeger）
- 不做 canary deployment（无 k8s 流量分流能力）
- 不引入 ML / 语义模型匹配事故（用 tag-based grep 替代）

---

## 3. 设计原则

> 护栏的目的是让**危险操作变慢**，而不是让**所有操作变难**。
> RED 操作多等 30 秒，GREEN 操作零延迟。
> 每加一道确认就问：当第 100 次触发时，人还会认真看吗？

---

## 4. 核心设计

### 4.1 三档 Tier 分级

| Tier | 定义 | 处理 | 例子 |
|------|------|------|------|
| 🟢 **GREEN** | 完全可逆，read-only / 影响单一非 prod 服务 | AI 直接执行，事后追加 audit log | `git status` / `ls` / `SELECT` / curl GET / `tail logs` / `docker ps` |
| 🟡 **YELLOW** | 部分可逆，影响单一服务，需短暂中断 | AI 自行 dry-run + 告知用户，无需 ritual | `docker restart <服务>` / `nginx -t` / 修改本地非 secret 文件 / `ADD COLUMN` 类非破坏性 ALTER |
| 🔴 **RED** | 不可逆或影响多服务，testnet/mainnet 资金链路 | **必须** dual sub-agent ritual + 用户显式 confirm | `ALTER USER` / `DROP TABLE` / `DELETE FROM` / `docker stop+rm` / `systemctl stop` / `aws ec2 terminate` / RDS snapshot restore / 任何 testnet/mainnet 关键词命令 |

### 4.2 RED 命令检测正则（机器可读）

写入 `web-api/.claude/rules/infra-ops-safety.md`，hook 脚本可直接 source：

```bash
RED_PATTERNS=(
  # DB 破坏性
  '(?i)drop\s+(table|database|user|index|schema)'
  '(?i)truncate\s+table'
  '(?i)delete\s+from'
  '(?i)alter\s+user.*(identified|password)'
  '(?i)update\s+.*set\s+.*(password|secret|token|key)\s*='
  '(?i)grant\s+|revoke\s+'

  # 容器破坏性
  '(?i)docker\s+(stop|rm|kill|prune)\s+'
  '(?i)docker\s+system\s+prune'

  # 系统服务破坏性
  '(?i)systemctl\s+(stop|disable|mask)\s+'

  # AWS 破坏性
  '(?i)aws\s+ec2\s+(terminate|stop|delete)'
  '(?i)aws\s+rds\s+(delete|reboot|restore)'

  # 资金链路关键词（即便操作本身可逆）
  '(?i)testnet|mainnet'

  # 不可逆文件操作
  '(?i)rm\s+-rf\s+/'
  '(?i)mkfs|dd\s+if=.*of=/dev/'
)
```

### 4.3 PRE-FLIGHT Ritual（RED 必走）

AI 检测到 RED 命令时**必须先**输出以下结构化报告 + 等用户 `YES` 才执行：

````markdown
## [PRE-FLIGHT] <操作名> — Tier: RED

**目标命令**：`<完整 bash 命令>`
**目标环境**：prod / testnet / staging

### A. Impact Analyst（spawn sub-agent A 输出）

- **直接受影响服务**：<列表，含 EC2 + 容器名 + 进程名>
- **共享凭据评估**：<引用 web-api/docs/infra/shared-resources-map.md §X>
- **连接池状态**：<SHOW PROCESSLIST 结果，活动连接数 + 源 IP>
- **下游依赖**：<谁会因此操作 timeout？>

### B. Incident Pattern Matcher（spawn sub-agent B 输出）

- **匹配 incidents/INC-*.md**：<grep tags，列匹配的 INC + 关键防复发措施>
- **匹配 memory feedback_***：<跨会话教训>
- **无匹配 → 标 "新型操作"，要求特别谨慎**

### C. 回滚方案

- **回滚命令**：<逐条 bash，含从 logs 提取当前状态的 trick>
- **预计停机**：<N 秒>

### D. 执行请求

> 已完成 pre-flight。请确认：[YES 执行] / [NO 取消]
> YES 后追加 audit log 到 .claude/AUDIT_LOG.md
````

### 4.4 sub-agent A: impact-analyst（briefing 模板）

AI orchestrator 在 RED 操作前 spawn 此 agent。Prompt 模板：

```
你是 impact-analyst sub-agent。

操作：<bash 命令>
目标：列出爆炸半径。

【必查】
1. 读 /Users/hang/work/oddfi-backend/web-api/docs/infra/shared-resources-map.md
   找到与本操作相关的资源（DB user / Redis / 容器 / 端口）
2. 如涉及 RDS user：
   - ssh oddfi-backend 跑 `SHOW PROCESSLIST` 看活动连接
   - 反查源 IP → EC2 名
3. 如涉及容器 stop/rm：
   - docker inspect 看 Mounts + Env，评估能否快速回滚
4. 如涉及端口变更：
   - ss -tlnp 看是否冲突

【输出】（≤ 100 行）
- 受影响服务清单（含 EC2 + 进程 + 是 prod/dev/testnet）
- 当前活动连接数
- 是否含「无法热重启」的硬编码服务（参考 shared-resources-map §4）
- 一句话风险评级（low/medium/high）
```

### 4.5 sub-agent B: incident-matcher（briefing 模板）

```
你是 incident-pattern-matcher sub-agent。

操作：<bash 命令>
目标：检查是否撞过类似事故。

【必查】
1. ls /Users/hang/work/oddfi-backend/web-api/docs/incidents/INC-*.md
2. grep 每个 INC 的 tags（# 后面的标签）
3. 提取本操作的特征 tags（password-rotation / drop-table / restart-service / 等）
4. 匹配 INC tags vs 操作 tags
5. 读 /Users/hang/.claude/projects/-Users-hang-work-oddfi-backend/memory/feedback_*.md
   找跨会话沉淀的教训

【输出】（≤ 50 行）
- 匹配到的 INC 列表（含编号 + 一句话总结 + 防复发措施）
- 匹配到的 memory feedback 条目
- 如完全无匹配，明确标 "无历史记录，新型操作"
```

### 4.6 EMERGENCY_BYPASS

用户喊出关键词 `EMERGENCY` / `紧急回滚` / `emergency-bypass` 时，AI 跳过 ritual 直接执行 RED 命令，但必须：

1. 在 audit log 中红字标记 `EMERGENCY_BYPASS_USED`
2. 操作完成后 24h 内补一份事后审计（pre-flight 倒着写）
3. 该次操作必须被 INC 化（不论是否真有事故，记录该 bypass 事件）

AI 不能自己决定 bypass，必须**人类显式喊出关键字**。

---

## 5. Hook 设计

### 5.1 范围严格控制

| 命令档位 | Hook 行为 |
|---------|-----------|
| GREEN | 静默执行，PostToolUse 静默 audit log |
| YELLOW | PreToolUse 提示「这是 YELLOW，请确认有 dry-run」，不阻断 |
| RED | PreToolUse **硬阻断**（exit 1），强制 AI 走 ritual |
| RED + EMERGENCY 关键字 | PreToolUse 放行 + audit log 标 `EMERGENCY_BYPASS` |

### 5.2 实现位置

扩展现有 `web-api/.claude/hooks/guard-bash.sh`（已挂在 PreToolUse:Bash），不新建文件。

骨架（dev agent 实现时 reference）：

```bash
#!/usr/bin/env bash
# guard-bash.sh — PreToolUse:Bash 拦截器
# 输入：通过 $CLAUDE_TOOL_INPUT_COMMAND 或 stdin JSON 拿到即将执行的命令
# 退出码：0 放行；1 阻断 + stderr 提示

CMD="${CLAUDE_TOOL_INPUT_COMMAND:-}"

# 1. EMERGENCY_BYPASS 关键字检测（仅人类对话中可触发）
# 这里需要从 .claude/state/ 或 hook env 拿到 "this turn 用户消息含 EMERGENCY"
# dev agent 实现时按 hook 协议定细节
if grep -qE 'EMERGENCY|紧急回滚|emergency-bypass' /tmp/claude-last-user-message 2>/dev/null; then
    echo "[guard-bash] EMERGENCY_BYPASS detected — RED gate skipped"
    echo "[$(date -Is)] BYPASS_USED: $CMD" >> .claude/AUDIT_LOG.md
    exit 0
fi

# 2. 加载 RED_PATTERNS（source rules/infra-ops-safety.md 提取的 patterns）
source .claude/rules/infra-ops-safety.patterns

# 3. 检测 RED
for pattern in "${RED_PATTERNS[@]}"; do
    if echo "$CMD" | grep -qiP "$pattern"; then
        cat >&2 <<EOF
🔴 RED OPERATION DETECTED
Command: $CMD
Matched pattern: $pattern

This is a high-risk irreversible operation.
You MUST first run the dual sub-agent PRE-FLIGHT ritual:
  1. spawn impact-analyst sub-agent → 列爆炸半径
  2. spawn incident-pattern-matcher sub-agent → 检索历史事故
  3. 综合输出 [PRE-FLIGHT] template
  4. 等待用户显式 YES

To bypass (true emergency only): include keyword 'EMERGENCY' in your message.

See: web-api/docs/design/ENH-002-ai-ops-safety-guardrails.md §4
EOF
        exit 1
    fi
done

# 4. 检测 YELLOW（仅提醒，不阻断）
for pattern in "${YELLOW_PATTERNS[@]}"; do
    if echo "$CMD" | grep -qiP "$pattern"; then
        cat >&2 <<EOF
🟡 YELLOW operation: $CMD
Reminder: ensure you have done dry-run or impact check.
EOF
        # 不退出，放行
        break
    fi
done

# 5. GREEN 直接放行
exit 0
```

### 5.3 PostToolUse:Bash → audit log

```bash
#!/usr/bin/env bash
# audit-bash.sh — PostToolUse:Bash 静默追加
CMD="${CLAUDE_TOOL_INPUT_COMMAND:-}"
RC="${CLAUDE_TOOL_EXIT_CODE:-?}"
ts=$(date -u +%FT%TZ)
printf '%s | rc=%s | %s\n' "$ts" "$RC" "$CMD" >> web-api/.claude/AUDIT_LOG.md
```

---

## 6. INCIDENTS Pattern Matching

### 6.1 Tag 约定

每个 `incidents/INC-*.md` 文件**必须**在头部 yaml frontmatter 或文档标题下方列 tags：

```markdown
# INC-NNN: <标题>

**Tags**: `#password-rotation` `#blast-radius` `#testnet` `#shared-credential`
```

Tag 词汇表（建议起步集合，可扩展）：

| Tag | 触发场景 |
|-----|---------|
| `#password-rotation` | DB / API / token 密码轮换 |
| `#blast-radius` | 操作影响范围超预期 |
| `#testnet` / `#mainnet` / `#prod` | 涉及对应环境 |
| `#shared-credential` | 多服务共用凭据 |
| `#hardcoded-secret` | 凭据被硬编码到 binary / image |
| `#cutover` | 部署切换 |
| `#docker-restart` / `#systemd-restart` | 容器/服务重启 |
| `#schema-change` | DB schema 变更 |
| `#network-acl` | SG / firewall 变更 |
| `#dns-change` | DNS 变更 |
| `#cert-expiry` | TLS 证书相关 |
| `#mac-arm64` | Mac M 构建 → linux 部署的 arch 问题 |

### 6.2 incident-matcher sub-agent 流程

```
1. 从待执行命令中提取关键词
   - "ALTER USER" → tag candidate: #password-rotation #shared-credential
   - "DROP TABLE" → tag candidate: #schema-change #irreversible
   - "docker stop" → tag candidate: #docker-restart
   - "testnet|mainnet" → tag candidate: #testnet / #mainnet

2. grep web-api/docs/incidents/INC-*.md 中 Tags 行
   匹配 candidates

3. 对每个匹配 INC：
   - 读 §1 摘要
   - 读 §7 行动项（防复发措施）
   - 输出："⚠️ INC-XXX 相关：<摘要> → 检查点：<行动项>"
```

### 6.3 memory 关联

补充 grep `~/.claude/projects/.../memory/feedback_*.md`：

- `feedback_verify_before_claim` → 凡涉及 SG/SSH/拓扑结论的 RED 操作必读
- `feedback_docker_deploy_arch` → 凡涉及 Mac M build + cutover 顺序的 RED 操作必读

---

## 7. 文件 / 目录组织

```
oddfi-backend/web-api/
├── .claude/
│   ├── AUDIT_LOG.md                  ← 新增，gitignored，本地审计日志
│   ├── hooks/
│   │   ├── guard-bash.sh              ← 现有，扩展 RED 检测
│   │   └── audit-bash.sh              ← 新增，PostToolUse 静默 log
│   ├── rules/
│   │   ├── infra-ops-safety.md        ← 新增，规则定义
│   │   └── infra-ops-safety.patterns  ← 新增，hook 可 source 的 regex 列表
│   └── settings.json                  ← 修改，挂 audit-bash.sh
│
└── docs/
    ├── design/
    │   ├── README.md
    │   └── ENH-002-ai-ops-safety-guardrails.md  ← 本文件
    │
    ├── incidents/                     ← 现有
    │   ├── README.md                   ← 现有，待加 tag 词汇表
    │   └── INC-001-*.md                ← 现有，待加 Tags 字段
    │
    └── infra/
        └── shared-resources-map.md    ← 现有，AI 跑 RED 前必读
```

### 7.1 .claude/AUDIT_LOG.md 进 .gitignore

格式：
```
2026-05-27T03:14:15Z | rc=0 | docker restart web-api
2026-05-27T03:14:32Z | rc=0 | EMERGENCY_BYPASS_USED: docker stop web-api
2026-05-27T03:15:01Z | rc=1 | guard-bash blocked RED: ALTER USER 'admin'@'%' ...
```

---

## 8. 实施计划

### 8.1 P0（必须先做，~75 min）

| # | 任务 | 时间 | 落地位置 |
|---|------|------|---------|
| **P0.1** | 写 `web-api/.claude/rules/infra-ops-safety.md` 规则文件 | 25 min | rules/ |
| **P0.2** | 写 `web-api/.claude/rules/infra-ops-safety.patterns`（hook 可 source） | 10 min | rules/ |
| **P0.3** | 扩展 `web-api/.claude/hooks/guard-bash.sh` 加 RED 检测 + EMERGENCY_BYPASS | 25 min | hooks/ |
| **P0.4** | 更新 `web-api/docs/incidents/README.md` 加 Tag 词汇表 | 5 min | incidents/ |
| **P0.5** | 给 `INC-001` 补 Tags 字段 | 5 min | incidents/INC-001 |
| **P0.6** | 在 `web-api/CLAUDE.md` 或根 `CLAUDE.md` 添加引用 ENH-002 + 强制要求 | 5 min | CLAUDE.md |

**验收**：
- AI 跑 `ALTER USER` / `DROP TABLE` 等 RED 命令时被 hook block + 提示走 ritual
- AI 跑 `git status` / `ls` 不被打扰
- AI 跑 `docker restart web-api` 看到 YELLOW 提醒不阻断

### 8.2 P1（本周完成，~70 min）

| # | 任务 | 时间 |
|---|------|------|
| **P1.1** | 写 `web-api/.claude/hooks/audit-bash.sh` + 挂 PostToolUse | 20 min |
| **P1.2** | 写 sub-agent prompt 模板：impact-analyst + incident-matcher（嵌入 ENH-002 §4.4/§4.5） | 25 min |
| **P1.3** | GitHub branch protection: main 1 review required | 5 min |
| **P1.4** | 写 `web-api/.claude/lib/pre-flight-helpers.sh`（read-before-write 工具函数） | 20 min |

**验收**：
- AI 跑 bash 后 audit log 自动追加
- AI 在 RED 操作时**主动 spawn 两个 sub-agent**（不靠 hook 强迫，靠 ENH-002 引用）
- main 分支无法直接 push（必须经 PR）

### 8.3 P2（下个 sprint）

| # | 任务 |
|---|------|
| **P2.1** | 协调 herongwei 重构 6 个硬编码镜像（market 三件套 + market-dev 三件套） |
| **P2.2** | RDS 拆 per-service user，逐步 deprecate admin@% |
| **P2.3** | Redis bind 收敛到 127.0.0.1 + auth 启用（shared-resources-map §3 顺手发现） |
| **P2.4** | postmortem 模板（5 字段）成型 + 团队约定 48h 内填完 |
| **P2.5** | dry-run flag 加进所有 deploy 脚本（`./script.sh --dry-run`） |

---

## 9. 验收标准（机器可查 + 人工 review）

### 9.1 P0 验收（自动化测试）

dev 在实施完后跑这些命令验证：

```bash
# 测试 1: RED 应被 block
echo 'ALTER USER admin@% IDENTIFIED BY foo' | <调用 guard-bash.sh>
# 期望：exit 1 + stderr 提示走 ritual

# 测试 2: GREEN 应放行
echo 'git status' | <调用 guard-bash.sh>
# 期望：exit 0

# 测试 3: YELLOW 应提醒不阻断
echo 'docker restart web-api' | <调用 guard-bash.sh>
# 期望：exit 0 + stderr "YELLOW" 提醒

# 测试 4: EMERGENCY_BYPASS
echo 'EMERGENCY' > /tmp/claude-last-user-message
echo 'DROP TABLE foo' | <调用 guard-bash.sh>
# 期望：exit 0 + audit log 含 BYPASS_USED

# 测试 5: pattern 覆盖率
grep -c 'pattern' web-api/.claude/rules/infra-ops-safety.patterns
# 期望：≥ 15 条 RED + ≥ 5 条 YELLOW
```

### 9.2 P0 人工 review checklist

- [ ] `infra-ops-safety.md` 规则文件含三档定义 + RED 模式列表 + ritual 模板
- [ ] `guard-bash.sh` 修改保留了原有功能（不破坏现有拦截）
- [ ] `INC-001` 含完整 Tags 字段
- [ ] `incidents/README.md` 含 tag 词汇表
- [ ] 实施 commit message 含「[ENH-002]」标记

### 9.3 P1 验收

- [ ] `audit-bash.sh` 跑通，每个 bash 在 AUDIT_LOG.md 追加 1 行
- [ ] AUDIT_LOG.md 在 .gitignore（不入库）
- [ ] sub-agent prompt 模板有可复用版本（不是每次手抄）
- [ ] main 分支保护开启

### 9.4 端到端测试

模拟 INC-001 场景：让 AI 尝试 `ALTER USER` → 期望被 hook block → AI 自动 spawn 两个 sub-agent → 输出 PRE-FLIGHT 报告 → 用户 NO → 操作取消。

---

## 10. 拒绝清单

| 方案 | 拒绝理由 |
|------|---------|
| CAB / 变更票系统 | 10 人团队会变剧场，维护 workflow 本身就是 toil |
| Production Readiness Review 全套 | 需要专职 SRE，超出当前组织规模 |
| Canary deployment | 需要 k8s / 流量分流能力，当前栈不支持 |
| 全链路 APM（Datadog / Jaeger） | 暂不接，先做好结构化日志和 audit log |
| AI 对每条命令都确认 | 疲劳失效 anti-pattern，违背设计原则 |
| ML / 语义模型匹配事故 | 当前规模 grep + tag 足够，复杂度收益不成正比 |
| Terraform / Pulumi 引入 | 5 台 EC2 + 1 RDS 不需要 IaC，引入成本超过收益 |

---

## 11. 风险 / 兼容性

### 11.1 已知风险

| 风险 | 缓解 |
|------|-----|
| Hook 拦截误报，影响正常工作 | 仅拦截严格 RED 模式；YELLOW 不阻断只提醒；提供 EMERGENCY 关键字 bypass |
| AI 没主动 spawn sub-agent | hook 强制 + rule 文件双重保险；AI 不遵守则 RED 命令永远跑不通 |
| EMERGENCY_BYPASS 被滥用 | 强制 audit log + 24h 内 postmortem；review 每条 bypass |
| `incidents/` tag 词汇表碎片化 | 在 incidents/README 维护权威词汇表，定期 grep 实际使用统计 |

### 11.2 兼容性

- 现有 `guard-bash.sh` 行为保留（只加 RED 拦截，不删原有逻辑）
- 现有 `go-check.sh` PostToolUse 不动
- 已有规则文件不动
- 不影响 cron / monitoring 脚本

---

## 12. 关联资料

- **事故源**：[INC-001](../incidents/INC-001-2026-05-26-rds-admin-password-rotation-broke-testnet.md)
- **爆炸半径源真值**：[shared-resources-map.md](../infra/shared-resources-map.md)
- **现有规则文件**：`web-api/.claude/rules/{git-workflow,build-deploy,code-quality,...}.md`
- **memory feedback**：
  - `~/.claude/projects/.../memory/feedback_verify_before_claim.md`
  - `~/.claude/projects/.../memory/feedback_docker_deploy_arch.md`
- **业界对标**：
  - [Google SRE Book - Embracing Risk](https://sre.google/sre-book/embracing-risk/)
  - [PagerDuty Postmortem Template](https://response.pagerduty.com/after/post_mortem_template/)
  - [AI Agent Blast Radius - bigguyonstuff.com](https://bigguyonstuff.com/ai-agent-blast-radius/)
  - [Dry-Run Engineering - DEV Community](https://dev.to/danieljglover/dry-run-engineering-the-simple-practice-that-prevents-production-disasters-ek0)
  - [ChatOps Fatigue - Tines Blog](https://www.tines.com/blog/chatops-fatigue-how-to-create-alerts-that-matter/)

---

## 13. 后续行动（DONE 状态前必须完成）

- [ ] 用户 APPROVED 此 DRAFT
- [ ] dev agent 实施 P0（按 §8.1）
- [ ] dev agent 跑 §9.1 自动化测试 + §9.2 人工 checklist
- [ ] 端到端测试通过（§9.4）
- [ ] 实施 commit 含 [ENH-002] 标记
- [ ] 本文档状态更新为 DONE
- [ ] 更新 `docs/design/README.md` 索引表
- [ ] dev agent 出 P1 实施计划（可作为 ENH-002 follow-up）

---

## 14. 备注：实施 agent 指引

实施这份 ENH 的 dev agent 注意：

1. **不要**修改本 ENH 文档以外的方案细节，如有歧义先问用户
2. **必须**实施完 P0 后跑端到端测试（§9.4 模拟 ALTER USER）
3. **必须**在 commit message 含 `[ENH-002]` 标记
4. **必须**保留现有 hook 功能（增量改造，不替换）
5. 实施完输出：动了哪些文件 / P0 验收结果 / 是否触发风险
6. **不要** ssh prod 服务器（本 ENH 纯本地基建改造）
7. **不要** 自己写 EMERGENCY_BYPASS 测试（避免 audit log 污染）
