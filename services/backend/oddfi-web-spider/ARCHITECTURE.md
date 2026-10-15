# oddfi-web-spider 架构文档入口

最新完整架构文档维护在：

```text
docs/ARCHITECTURE.md
```

当前仓库新增的外部服务监控能力维护在：

```text
scripts/monitor_docker_lark.py
docs/MONITORING.md
```

监控脚本用于在 AWS 宿主机上常驻检查一个或多个 Docker 容器的运行状态，巡检间隔固定为 3600 秒；容器名支持逗号分隔、多次传参，并兼容逗号后带空格的命令行写法。所有容器正常时只打印日志，发现异常容器时才通过 `LARK_WEBHOOK_URL` 推送 Lark 群富文本消息。该能力属于宿主机侧运维监控，不改变 Go 服务主进程的数据采集链路。
