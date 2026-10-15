# oddfi-backend
- 存放 oddfi 后端服务各模块代码

- [oddfi-web-spider](oddfi-web-spider) ： 详情页比赛 api 爬虫服务
- [oddfi-data-ws](oddfi-data-ws) ： 详情页数据推送服务（⛔ 仅 README，未实现）
- [oddfi-web-api](oddfi-web-api) ： 详情页数据 api 服务
- [web-api](web-api) ： 登录/充值/提现/下注/预售/邀请 api 服务
- [oddfi-odds-engine](oddfi-odds-engine) ： 自营盘动态赔率引擎（⛔ 未上线）

# 工程文档（新同事 / 跨服务）

> 单服务深度文档仍在各自 `*/docs/`；本目录只放跨服务视角的总览。

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 服务关系图 + 跨服务通道（MySQL / Redis 共享映射） + 数据流场景
- [docs/SERVICES.md](docs/SERVICES.md) — 每个服务一句话定位、入口、端口、状态、owner
- [docs/API.md](docs/API.md) — 接口分布与鉴权对照表（细节请看下方 Swagger）

# API 文档

`main` 分支更新 `oddfi-web-api` 或 `web-api` 后，GitHub Actions 会自动生成 Swagger 文档并部署到 GitHub Pages。

- 总入口：https://crypto-barrett.github.io/oddfi-backend/
- `oddfi-web-api`：https://crypto-barrett.github.io/oddfi-backend/oddfi-web-api/
- `web-api`：https://crypto-barrett.github.io/oddfi-backend/web-api/

本地生成和预览：

```bash
make swagger
make swagger-site
make swagger-serve
```

首次启用 GitHub Pages 时，需要在仓库设置中选择 `Settings -> Pages -> Build and deployment -> Source: GitHub Actions`。

# 项目结构
- 有新增的后端服务统一更新到本仓库
- 每个服务的代码都在对应的目录下
- 更新每个仓库的 readme 文件    
- 每个服务的代码都在对应的目录下
