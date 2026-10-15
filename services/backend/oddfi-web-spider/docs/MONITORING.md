# web-spider Docker 运行监控

本文档说明如何在 AWS 机器上用 Python 脚本常驻检查 Docker 容器状态。脚本默认每 3600 秒检查一次，正常时只打印本地日志，只有发现异常容器时才把富文本消息推送到 Lark 群。

## 1. 脚本位置

```text
scripts/monitor_docker_lark.py
```

脚本特性：

1. 无第三方 Python 依赖，只使用标准库。
2. 默认检查 Docker 容器名 `web-spider`。
3. 默认服务名 `oddfi-web-spider`。
4. 支持一次检查多个 Docker 容器，容器名可以逗号分隔或多次传参。
5. 支持通过 Lark 自定义机器人 webhook 推送 `post` 富文本异常消息。
6. 默认就是 nohup/systemd 友好的常驻模式，间隔固定为代码中的 `3600` 秒。

## 2. Lark 群机器人配置

在 Lark 群中添加自定义机器人，复制 webhook URL，例如：

```text
https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

脚本只需要 webhook URL，不需要签名密钥。

## 3. 单次验收运行

单次运行用于上线前验收或手动调试。注意：脚本现在只在异常时推送 Lark，如果容器都正常，单次运行只会打印日志，不会发群消息。

```bash
export LARK_WEBHOOK_URL='https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

python3 scripts/monitor_docker_lark.py \
  --container-name web-spider \
  --service-name oddfi-web-spider \
  --instance-name aws-web-spider-prod-1 \
  --once
```

只打印异常 payload、不真实发送 Lark：

```bash
python3 scripts/monitor_docker_lark.py \
  --container-name web-spider \
  --service-name oddfi-web-spider \
  --instance-name aws-web-spider-prod-1 \
  --dry-run
```

如果需要验收 Lark webhook 是否能收到异常消息，可以临时加入一个不存在的容器名：

```bash
python3 scripts/monitor_docker_lark.py \
  --container-name web-spider,__monitor_test_missing__ \
  --service-name oddfi-web-spider \
  --instance-name aws-web-spider-prod-1 \
  --once
```

异常 Lark 富文本消息包含：

| 字段 | 说明 |
| --- | --- |
| 实例名称 | 当前 AWS 实例名称，建议按环境显式传入 |
| 服务名称 | 业务服务名，默认 `oddfi-web-spider` |
| 异常容器数 | 本轮异常容器数量 |
| 容器名称 | 异常 Docker 容器名 |
| 实例状态 | `正常 / RUNNING`、`异常 / EXITED` 等 |
| 状态说明 | 对 Docker 状态的解释 |
| Healthcheck | Docker healthcheck 状态；没有 healthcheck 时为 `-` |
| 镜像 | 容器镜像名 |
| 重启次数 | Docker `RestartCount` |
| 退出码 | 容器最近一次退出码 |
| OOMKilled | 是否被 OOM kill |
| 启动时间/退出时间/已运行 | 容器生命周期信息 |
| 检测时间 | 本轮脚本检测时间 |

## 4. nohup 常驻运行

推荐使用 root 执行，避免当前用户没有 Docker socket 权限。

假设仓库放在：

```text
/opt/oddfi-web-spider
```

单容器：

```bash
export LARK_WEBHOOK_URL='https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

nohup python3 /opt/oddfi-web-spider/scripts/monitor_docker_lark.py \
  --container-name web-spider \
  --service-name oddfi-web-spider \
  --instance-name aws-web-spider-prod-1 \
  >> /var/log/web-spider-monitor.log 2>&1 &
```

多容器，逗号分隔。推荐逗号后不要加空格；脚本已兼容误写成 `web-spider, oddfi-web-api-prod` 的情况，但无空格写法更清晰。

```bash
export LARK_WEBHOOK_URL='https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

nohup python3 monitor_docker_lark.py \
  --container-name web-spider,oddfi-web-api-prod \
  --service-name oddfi-backend \
  --instance-name aws-prod-backend03 \
  >> /home/ubuntu/log/oddfi-backend-monitor.log 2>&1 &
```

多容器，多次传参：

```bash
export LARK_WEBHOOK_URL='https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

nohup python3 monitor_docker_lark.py \
  --container-name web-spider \
  --container-name oddfi-web-api-prod \
  --service-name oddfi-backend \
  --instance-name aws-prod-backend03 \
  >> /home/ubuntu/log/oddfi-backend-monitor.log 2>&1 &
```

查看脚本日志：

```bash
sudo tail -f /var/log/web-spider-monitor.log
```

停止常驻脚本：

```bash
pgrep -af monitor_docker_lark.py
sudo kill <pid>
```

生产环境更严谨的方式是把同一条命令交给 systemd 管理，但当前 nohup 已满足单机快速监控诉求。

## 5. 参数和环境变量

| 参数 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--container-name` | `DOCKER_CONTAINER_NAMES` / `DOCKER_CONTAINER_NAME` | `web-spider` | Docker 容器名；支持逗号分隔、多次传参，也兼容逗号后带空格的命令行写法 |
| `--service-name` | `MONITOR_SERVICE_NAME` | `oddfi-web-spider` | Lark 消息中的服务名称 |
| `--instance-name` | `MONITOR_INSTANCE_NAME` | 当前 hostname | Lark 消息中的实例名称 |
| `--webhook-url` | `LARK_WEBHOOK_URL` | 空 | Lark 自定义机器人 webhook |
| `--docker-bin` | `DOCKER_BIN` | `docker` | Docker CLI 路径 |
| `--docker-timeout-seconds` | `DOCKER_TIMEOUT_SECONDS` | `10` | Docker inspect 超时 |
| `--lark-timeout-seconds` | `LARK_TIMEOUT_SECONDS` | `10` | Lark webhook 请求超时 |
| `--once` | 无 | 关闭 | 只执行一轮检测后退出 |
| `--dry-run` | 无 | 关闭 | 执行一轮检测；有异常时只打印 Lark payload，不推送 |

巡检间隔不再暴露命令行参数，固定为脚本中的：

```python
DEFAULT_INTERVAL_SECONDS = 3600
```

## 6. 状态判定

| Docker 状态 | Lark 状态 | 说明 |
| --- | --- | --- |
| `Running=true` 且 health 非 `unhealthy`/`starting` | `正常 / RUNNING` | 服务正在运行 |
| `Running=true` 且 health 为 `unhealthy` | `异常 / RUNNING_UNHEALTHY` | 容器进程仍在，但健康检查失败 |
| `Restarting=true` | `警告 / RESTARTING` | 容器正在重启 |
| `Paused=true` | `警告 / PAUSED` | 容器被暂停 |
| `Dead=true` | `异常 / DEAD` | 容器处于 dead 状态 |
| inspect 失败或容器不存在 | `异常 / NOT_FOUND_OR_DOCKER_ERROR` | 容器名错误、Docker 权限不足或 Docker 服务异常 |
| 其他非运行状态 | `异常 / {DOCKER_STATUS}` | 例如 `EXITED`、`CREATED` |

## 7. 推送策略

1. 所有容器正常：只打印本地日志，不发送 Lark。
2. 任意容器异常：聚合本轮所有异常容器，发送一条 Lark 富文本消息。
3. Lark 发送失败：打印错误日志，脚本不退出，下一轮继续检测。
4. Docker inspect 失败：视为异常，进入 Lark 告警。
