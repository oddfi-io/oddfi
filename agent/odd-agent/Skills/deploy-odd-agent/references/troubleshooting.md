# odd_agent 部署故障速查

| 现象                                                               | 根因                                                                                   | 处理                                                                                                                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 启动 `FOUNDATION_DB_INIT_FAILED` + `ENETUNREACH`                   | 目标机把 Supabase direct host 解析到 IPv6 但无 IPv6 出口                               | shared 配置 `db` 连接串改用 Supabase pooler IPv4：`aws-1-ap-southeast-1.pooler.supabase.com:6543`，重部署                                                       |
| 启动 `FOUNDATION_EMBEDDING_DB_INIT_FAILED` + `Headers.append` 报错 | shared 配置里 Pinecone/embedding 的 API key 值尾部带了换行/空白，拼进 HTTP header 非法 | 编辑 `shared/odd-agent.yaml` 把该 secret 写成单行无尾换行，重启。⚠️ 该错误会把 key 明文打进 journal stack trace（已知 secret 泄漏点），修好后留意日志，勿外传   |
| migration runner 报错执行 `._*.sql` / 乱码 SQL                     | macOS AppleDouble 文件 `._*.sql` 被同步进 `db/migrations` 并被当 SQL 跑                | 同步必须排除 `._*` / `.DS_Store` / `__MACOSX`（sync 脚本已含）；清理目标机 stage 后重部署                                                                       |
| 服务起不来，`journalctl` 显示配置/schema 校验失败                  | `shared/odd-agent.yaml` 非法或缺必填段（DD-134 缺 `internal_auth`）                    | 按报错定位到段，补齐后 `sudo systemctl restart odd-agent.service`；DD-134 见 dd-134-deployment.md                                                               |
| `/internal/*` 全返回 401（部署 DD-134 后）                         | middleware 已强制 token，但调用方/验收命令没带 `X-Service-Token`                       | 验收命令加 `-H "x-service-token: <值>"`；确认主后端注入的 `AI_AGENT_SERVICE_TOKEN` 与本服务 `SERVICE_TOKEN` 同值                                                |
| `/internal/*` 返回 500 `service_token_misconfigured`               | 代码已带 middleware 但 `internal_auth` secret 未配置/解析失败                          | 检查 shared 的 `internal_auth.service_token_secret_ref` 指向的 secret 在 `local_secrets` 或 env 中存在                                                          |
| health OK 但推送不工作 / `tag_push.publish_failed`                 | Centrifugo 容器未起或 HMAC secret 不一致                                               | `docker ps --filter name=centrifugo`；`/opt/centrifugo/config.json` 的 HMAC 与主后端 `CENTRIFUGO_HMAC_SECRET` 同值；`sudo systemctl restart centrifugo.service` |
| `tags.total` 不是 58 / `tag_snapshot.refresh` 异常                 | migration seed 未跑或 DB 连接异常                                                      | 确认 `migrate.js` 跑过（部署脚本含）；查 `journalctl` 的 `tag_snapshot.refresh_completed`                                                                       |
| Chat SSE 回复含 `<think>...</think>`                               | MiniMax reasoning 原样透传落库（已知问题，见生产部署说明 §6）                          | 业务决策是否过滤，非部署阻塞项                                                                                                                                  |

## 常用只读诊断

```bash
ssh oddfi-market 'set -e
  systemctl status odd-agent.service --no-pager -l | head -20
  journalctl -u odd-agent.service -n 120 --no-pager
  tail -n 120 /data/logs/odd_agent/odd-agent-$(date -u +%F).log
  readlink -f /opt/odd_agent/current
  docker ps --filter name=centrifugo
'
```

## 安全红线

- 不打印 `shared/odd-agent.yaml` / `centrifugo/config.json` 全文（含真实 secret）。诊断只 grep 段名/键名。
- 连接一律走 `~/.ssh/config` 别名 `oddfi-market`，禁止 `ssh -i <绝对路径>`。
- 这是 market-api 生产共用机，重启/改配置前确认不影响同机 market-api。
