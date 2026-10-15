# ADR-0004: prod 架构调研快照（2026-05-26）

**状态**：Accepted
**日期**：2026-05-26
**关联**：[cutover-dd003.md](../ops/cutover-dd003.md) · [ADR-0001](ADR-0001-admin-rpc-not-shared-db.md) · [ADR-0002](ADR-0002-deferred-mtls-jwt-blacklist-legacy-admin.md)

## 背景

DD-003 cutover 文档（`ops/cutover-dd003.md`）初稿基于错误假设编写：假定 web-api 以 systemd 运行、DB 名为 `oddfi`、EC2 单 EIP。2026-05-26 SSH 探测 prod 后发现实际架构与假设全面偏差。本 ADR 落档探测结果，作为后续所有运维文档的参考基线，并确立"先 probe 再写文档"的工作规范。

## 实际 prod 架构（2026-05-26 探测）

### 网络拓扑（ASCII 图）

```
Internet
  │
  └─ EIP: <SERVER_IP> ────────────────────────────────────────────┐
     （单 ENI 单 EIP，SSH + 服务流量共用此 IP）                       │
                                                                       │
                                              ┌────────────────────────▼──────────────────────┐
                                              │  oddfi-backend EC2 (c5.2xlarge, Ubuntu 24.04) │
                                              │  内网 IP: <PRIVATE_IP>/20                      │
                                              │  区域: ap-southeast-1                          │
                                              │                                                 │
                                              │  [Docker container: web-api]                   │
                                              │    image: 旧版 herongwei/account-web-api:prod   │
                                              │           新版 hankdong/account-web-api:prod    │
                                              │     (cutover 切换 namespace，详见下表)          │
                                              │    --network host (复用 host netns)             │
                                              │    旧版 listen :80                              │
                                              │    DD-003 新版 listen :8080 (public)            │
                                              │                    :8081 (loopback internal)    │
                                              │    RestartPolicy: no  ← ⚠️ 容器挂不自启        │
                                              │                                                 │
                                              │  nginx: 未安装（DD-003 §3 新装）               │
                                              │  systemd unit: 无                               │
                                              │  mysql client: /usr/bin/mysql ✓                 │
                                              └──────────────────┬──────────────────────────────┘
                                                                 │ VPC 私网 (<PRIVATE_IP>/16)
                                                                 │ SG: 3306 放行
                                                                 ▼
                                              ┌──────────────────────────────────────────────────┐
                                              │  RDS MySQL (ap-southeast-1)                      │
                                              │  Host: my-mysql-db.<RDS_ID>.                 │
                                              │         ap-southeast-1.rds.amazonaws.com         │
                                              │  私网 IP: <PRIVATE_IP>                          │
                                              │  端口: 3306                                      │
                                              │  User: admin                                     │
                                              │  DB: project_oddfi  ← 不是 oddfi！              │
                                              └──────────────────────────────────────────────────┘

Internet
  │
  └─ admin EIP: <SERVER_IP> ─────────────────────────────────────┐
                                                                       │
                                              ┌────────────────────────▼──────────────────────┐
                                              │  oddfi-admin EC2 (Ubuntu)                      │
                                              │  内网 IP: <PRIVATE_IP>/20（不同 subnet）        │
                                              │                                                 │
                                              │  [systemd: oddfi-admin-server.service]          │
                                              │    binary: /usr/local/bin/oddfi-admin-server    │
                                              │    config:  /etc/oddfi-admin/config.yaml        │
                                              │    env:     /etc/oddfi-admin/env.production     │
                                              │    listen:  127.0.0.1:8081                      │
                                              │    user:    oddfi, enabled=yes                  │
                                              │                                                 │
                                              │  nginx: 已安装                                  │
                                              │    vhost: admin.oddfi.io → :8081               │
                                              │    TLS: Let's Encrypt (auto-renew)              │
                                              │                                                 │
                                              │  RDS 直连: ❌ timeout（设计意图，SG 未放行）    │
                                              └──────────────────────────────────────────────────┘
```

### DD-003 部署后的调用链

```
admin operator (browser)
      │ HTTPS 443
      ▼
  admin.oddfi.io (nginx on oddfi-admin EC2)
      │ proxy_pass 127.0.0.1:8081
      ▼
  oddfi-admin-server (systemd, Go binary)
      │ HTTPS → admin-api.oddfi.io (nginx on oddfi-backend EC2)
      │ IP allow: <SERVER_IP> only
      ▼
  admin-api.oddfi.io (nginx on oddfi-backend EC2, DD-003 新装)
      │ proxy_pass 127.0.0.1:8081
      ▼
  web-api container (internal listener 127.0.0.1:8081)
      │ GORM (VPC 私网)
      ▼
  RDS: project_oddfi
```

## 各组件关键事实汇总

### web-api（oddfi-backend EC2）

| 项目 | 值 |
|---|---|
| 部署方式 | Docker，容器名 `web-api` |
| 镜像（cutover 前） | `herongwei/account-web-api:prod` — 2026-05-26 探测时运行的镜像 |
| 镜像（cutover 后） | `hankdong/account-web-api:prod`（namespace 切换原因见下） |
| 网络模式 | `--network host`（容器复用 host network namespace） |
| 配置注入 | `config_prod.yaml` 在 build 时 `COPY` 进镜像为 `/app/config.yaml`，无运行时环境变量注入 |
| 构建入口 | `web-api/Dockerfile`（multi-stage: golang:1.25-alpine → alpine:3.19） |
| 发版账号 | Docker Hub: `hankdong`（DD-003 cutover 起；旧版 prod 镜像由 `herongwei` 账号推送，但当前发版人 hankdong 不在 `herongwei` collaborators 列表，cutover 期间切到 hankdong namespace 避免阻塞） |
| RestartPolicy | `no`（容器崩溃不自启，已标为 hidden risk） |
| 旧版监听端口 | `:80` |
| DD-003 新版监听端口 | `:8080`（public）+ `127.0.0.1:8081`（internal loopback） |
| 日志 | `--log-opt max-size=1000m --log-opt max-file=3` |
| nginx | 未安装（DD-003 §3 新装） |
| systemd | 无 unit |

### admin-backend（oddfi-admin EC2）

| 项目 | 值 |
|---|---|
| 部署方式 | systemd，unit: `oddfi-admin-server.service` |
| binary | `/usr/local/bin/oddfi-admin-server` |
| config | `/etc/oddfi-admin/config.yaml`（mysql 节为空，DSN 通过 env 注入） |
| env | `/etc/oddfi-admin/env.production`（EnvironmentFile，含敏感凭据） |
| 监听 | `127.0.0.1:8081` |
| nginx | 已安装，`admin.oddfi.io` vhost + Let's Encrypt TLS |
| RDS 直连 | 不通（SG 未放行，设计意图） |

### RDS

| 项目 | 值 |
|---|---|
| Host | `<RDS_HOST>` |
| 私网 IP | `<PRIVATE_IP>` |
| 端口 | `3306` |
| User | `admin` |
| **DB 名** | **`project_oddfi`**（历史文档误写为 `oddfi`） |
| web-api → RDS | ✅ VPC 内 SG 放行 |
| admin EC2 → RDS | ❌ timeout（未放行，设计意图） |

### 单 EIP 设计（oddfi-backend）

c5.2xlarge 实例绑定**单 ENI 单 EIP** `<SERVER_IP>`，IMDS 实测 `device-number=0 / public-ipv4s` 唯一。SSH 管理与对外服务（api.oddfi.io / admin-api.oddfi.io）复用同一 IP。

> **历史误记纠正**（2026-05-26 IMDS 实测）：本 ADR 初稿与 `~/.ssh/SERVERS.md` 旧版本曾记「双 EIP，SSH 走 <SERVER_IP> / 服务走 <SERVER_IP>」——实测发现 <SERVER_IP> 不在当前实例上（疑似旧 EIP 已解绑/迁移）。SSH 与 API 实际共用 <SERVER_IP>。后续涉及 SG / SSH / 网络拓扑结论前必须用 IMDS / `ip -br addr` / `nc -vz` 等实测验证，参见记忆条目 `feedback_verify_before_claim`。

## 决策

**后续所有 cutover / 部署文档在编写前必须 SSH probe prod 状态，用实际探测值填写，不得依赖假设。**

具体要求：
1. 文档中出现的 DB 名、EC2 实例类型、EIP、监听端口、容器参数等，必须来自 `docker inspect` / `cat config*.yaml` / `aws ec2 describe-instances` 等实际命令输出
2. 探测结果中与原有文档不符的，必须在文档开头标注差异（如本 ADR 的背景段）
3. 本 ADR 作为参考基线，后续架构变更需更新本文档

## 后果

### 正面
- cutover-dd003.md 基于真实架构重写，执行时不会因架构假设错误失败
- DB 名 `project_oddfi` 已在所有相关命令中修正
- Docker 流程（build → push → pull → run）替代旧 systemd + binary scp 流程，与实际 prod 一致
- web-api EC2 无 nginx 的事实已反映在 §3 需要新装的步骤中

### 负面 / 遗留风险
- `RestartPolicy=no`：容器崩溃不自启，需 DevOps 手工干预或改为 `--restart unless-stopped`（不在 DD-003 cutover 范围，单独 track）
- admin EC2 与 web-api EC2 在不同 subnet（172.31.9.x vs 172.31.44.x），VPC 内直连走 SG；如需 admin EC2 → RDS 直连，需 SG 变更（当前设计不需要）

### 长期
- 下一次架构变更（如容器化 admin-backend、引入 ECS/EKS）前，更新本 ADR
- 考虑将 `RestartPolicy` 改为 `unless-stopped` 或迁移到有健康检查的编排平台
