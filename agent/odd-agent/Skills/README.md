# Skills · odd_agent 运维与协作技能库

本目录统一管理 **oddfi-ODD-Agent** 项目的可复用操作技能（部署、运维、协作流程等），每个技能一个子文件夹，自包含、可独立查阅。

> 区别于 `docs/`（功能架构与设计文档）：`Skills/` 装的是「**怎么操作**」的可执行 SOP，给人和 AI agent 直接照着干活。

## 技能清单

| 技能                 | 用途                                                                                                                                      | 入口                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **deploy-odd-agent** | 把 odd_agent 服务部署到目标机的完整 SOP：本机同步 → 远端构建发布 → migration → systemd → 验收 → 回滚；含 DD-134 internal API 鉴权专项部署 | [deploy-odd-agent/SKILL.md](./deploy-odd-agent/SKILL.md) |

## 目录结构

```text
Skills/
├── README.md                         # 本文档地图
└── deploy-odd-agent/
    ├── SKILL.md                      # 主流程 SOP（目标机/架构/一键&手动部署/配置/验收/回滚）
    ├── scripts/
    │   └── sync-and-deploy.sh        # 本机一键：rsync 工作树 → 远端 deploy-remote.sh → 验收
    └── references/
        ├── dd-134-deployment.md      # DD-134 专项：internal_auth 配置 + SERVICE_TOKEN + 0007 migration + 带 token 验收
        └── troubleshooting.md        # 故障速查表 + 只读诊断命令 + 安全红线
```

## 与仓库既有部署资产的关系

- `deploy/`（仓库内）：部署的**底层资产**——systemd unit、Centrifugo 编排、Nginx Lua、以及目标机执行的 `deploy/scripts/deploy-remote.sh`。
- `docs/deployment/`：部署的**说明与历史记录**（生产部署说明、迁移说明、nginx-jwt-auth）。
- `Skills/deploy-odd-agent/`（本目录）：把上面两者**串成端到端可照做的 SOP**，并补全官方脚本缺失的「本机 → 目标机」前置一步。

三者关系：`Skills` 是入口与编排，`deploy/` 是被调用的脚本资产，`docs/deployment/` 是详尽背景与逐次部署留档。

## 约定

- 新增技能：在 `Skills/<技能名>/SKILL.md` 写主流程（建议带 `name` / `description` frontmatter），并在本 README 技能清单加一行。
- 技能内引用仓库资产用相对仓库根的路径，便于跨机器查阅。
- 涉及服务器操作的技能必须显式标注：SSH 走别名、不打印 secret、生产共用机的影响范围。
