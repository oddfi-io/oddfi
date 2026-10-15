# dev web-api 标准部署流程（核心规范）

> 适用：dev 服务器 `<SERVER_IP>`（oddfi-dev）上的 `web-api` 容器更换。
> 地位：**唯一合法部署入口**，所有后端同事必须遵守。手动 `docker run` / `docker stop` 换容器 = 违规。
> 背景：2026-06-06 一天内两次因裸跑部署丢 `ADMIN_API_*` env，致管理后台信号灯全线 503（详见 [事故记录](#4-事故记录为什么有这个规范)）。

## 1. 唯一命令

```bash
~/bin/deploy-web-api.sh <镜像:tag> <部署人> [原因]
```

示例：

```bash
~/bin/deploy-web-api.sh hankdong/web-api:dev-033c39f hang "ENH-005 liquidity 回填"
```

## 2. 脚本自动做的四件事

| # | 动作 | 价值 |
|---|---|---|
| 1 | 先 `docker pull` 后替换 | 拉取失败不伤现役容器 |
| 2 | 注入权威 env `~/oddfi-secrets/web-api-runtime.env` | **禁止手敲 `-e`**；env 文件是唯一真值源（含 `ADMIN_API_*` 管理后台鉴权三件套） |
| 3 | 自动登记 `~/oddfi-secrets/DEPLOY_LOG.md` | 谁、何时、什么镜像、替换谁、为什么——排障第一现场 |
| 4 | 健康检查（:80 主端口 + :8082 internal），失败自动回滚旧镜像 | 部署不变赌博 |

## 3. 约定

- 镜像 tag 建议带 commit 短 hash（如 `dev-033c39f`），从**已推送的 dev HEAD** 构建
- 改 `web-api-runtime.env` 后必须**重建容器**（走本脚本即可）——`docker restart` 不重读 env-file
- 部署后看到 `⚠️ 8082 internal 未就绪` 警告 → 你的镜像可能缺 internal listener 代码或 env 不全，**不要无视**，管理后台依赖它
- 排障入口：events/信号灯接口异常时，先查 `DEPLOY_LOG.md` 最近一条是不是你不知道的部署

## 4. 事故记录（为什么有这个规范）

| 日期 | 事故 | 根因 |
|---|---|---|
| 2026-06-06 上午 | 8082 断 + ADMIN env 丢 + 顶掉 BUG-005 修复 | 未登记裸跑部署（本登记簿因此而立） |
| 2026-06-06 下午 | 管理后台信号灯全线 503 约 3 小时 | 同上，第二次复发：裸跑 `docker run` 丢 `ADMIN_API_*` 两 env |

两次共同点：**镜像代码本身都没问题**，纯粹是绕过脚本导致 env 丢失。代码随便发、镜像随便换——只是换容器这一步必须走脚本。

## 5. 关联文档

- [`dd002-risk-signal/handoff/RUNBOOK-dd002-ops.md`](./dd002-risk-signal/handoff/RUNBOOK-dd002-ops.md) — DD002 运维总册（拓扑/secret 索引/回滚锚点）
- [`dd002-risk-signal/handoff/RUNBOOK-events-upstream-switch.md`](./dd002-risk-signal/handoff/RUNBOOK-events-upstream-switch.md) — events 上游 dev⇄生产切换
- 脚本源码：oddfi-dev `~/bin/deploy-web-api.sh`（改动需统筹 review）
