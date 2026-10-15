#!/usr/bin/env python3
"""Check Docker containers hourly and notify Lark only on abnormal states."""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


DEFAULT_CONTAINER_NAME = "web-spider"
DEFAULT_CONTAINER_NAMES = [DEFAULT_CONTAINER_NAME]
DEFAULT_SERVICE_NAME = "oddfi-web-spider"
DEFAULT_INTERVAL_SECONDS = 3600


@dataclass
class ContainerReport:
    instance_name: str
    service_name: str
    container_name: str
    level: str
    status: str
    status_detail: str
    health: str
    image: str
    container_id: str
    restart_count: str
    exit_code: str
    oom_killed: str
    started_at: str
    finished_at: str
    uptime: str
    checked_at: str
    error: str


def docker_inspect(docker_bin: str, container_name: str, timeout_seconds: int) -> Tuple[Optional[Dict[str, Any]], str]:
    """调用 docker inspect 获取容器原始状态；这里不用 shell，避免容器名参数被解释成命令片段。"""
    try:
        result = subprocess.run(
            [docker_bin, "inspect", container_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError:
        return None, f"docker binary not found: {docker_bin}"
    except subprocess.TimeoutExpired:
        return None, f"docker inspect timeout after {timeout_seconds}s"

    if result.returncode != 0:
        return None, (result.stderr or result.stdout or "docker inspect failed").strip()

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return None, f"docker inspect returned invalid json: {exc}"

    if not payload:
        return None, f"container not found: {container_name}"

    return payload[0], ""


def parse_docker_time(value: str) -> Optional[datetime]:
    """Docker 时间可能包含纳秒，Python datetime 只支持微秒，所以需要截断后再解析。"""
    if not value or value.startswith("0001-01-01"):
        return None

    match = re.match(r"^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$", value)
    if not match:
        return None

    prefix, fraction, tz_text = match.groups()
    tz_text = "+00:00" if tz_text in ("Z", None) else tz_text
    if fraction:
        fraction = fraction[:6].ljust(6, "0")
        normalized = f"{prefix}.{fraction}{tz_text}"
    else:
        normalized = f"{prefix}{tz_text}"

    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def format_docker_time(value: str) -> str:
    parsed = parse_docker_time(value)
    if parsed is None:
        return "-"
    return parsed.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")


def format_duration(seconds: int) -> str:
    if seconds < 0:
        return "-"
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    if days:
        return f"{days}天 {hours}小时 {minutes}分钟"
    if hours:
        return f"{hours}小时 {minutes}分钟"
    if minutes:
        return f"{minutes}分钟 {secs}秒"
    return f"{secs}秒"


def calc_uptime(started_at: str, running: bool) -> str:
    """只有容器仍在运行时才展示 uptime，避免已退出容器被误解为仍持续运行。"""
    if not running:
        return "-"
    started = parse_docker_time(started_at)
    if started is None:
        return "-"
    now = datetime.now(timezone.utc)
    return format_duration(int((now - started.astimezone(timezone.utc)).total_seconds()))


def classify_state(state: Dict[str, Any], health: str) -> Tuple[str, str, str]:
    """把 Docker 的低层状态压成监控状态，Lark 群里只需要一眼能判断正常/异常。"""
    if state.get("Running") and health == "unhealthy":
        return "异常", "RUNNING_UNHEALTHY", "容器仍在运行，但 Docker healthcheck 已判定不健康"
    if state.get("Restarting"):
        return "警告", "RESTARTING", "容器正在重启，可能是进程反复退出或宿主机资源异常"
    if state.get("Paused"):
        return "警告", "PAUSED", "容器被暂停，业务请求不会继续处理"
    if state.get("Running"):
        if health == "starting":
            return "警告", "RUNNING_STARTING", "容器运行中，healthcheck 仍在启动检查阶段"
        return "正常", "RUNNING", "容器运行中"
    if state.get("Dead"):
        return "异常", "DEAD", "容器处于 dead 状态，需要人工清理或重建"
    status = str(state.get("Status") or "unknown").upper()
    return "异常", status, "容器未处于运行状态"


def build_report(
    inspect_data: Optional[Dict[str, Any]],
    inspect_error: str,
    instance_name: str,
    service_name: str,
    container_name: str,
) -> ContainerReport:
    checked_at = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")

    if inspect_data is None:
        return ContainerReport(
            instance_name=instance_name,
            service_name=service_name,
            container_name=container_name,
            level="异常",
            status="NOT_FOUND_OR_DOCKER_ERROR",
            status_detail="未能读取容器状态，请检查容器名、Docker 权限或 Docker 服务本身",
            health="-",
            image="-",
            container_id="-",
            restart_count="-",
            exit_code="-",
            oom_killed="-",
            started_at="-",
            finished_at="-",
            uptime="-",
            checked_at=checked_at,
            error=inspect_error,
        )

    state = inspect_data.get("State") or {}
    config = inspect_data.get("Config") or {}
    health = str((state.get("Health") or {}).get("Status") or "-")
    level, status, detail = classify_state(state, health)
    docker_name = str(inspect_data.get("Name") or container_name).lstrip("/")
    container_id = str(inspect_data.get("Id") or "-")

    return ContainerReport(
        instance_name=instance_name,
        service_name=service_name,
        container_name=docker_name,
        level=level,
        status=status,
        status_detail=detail,
        health=health,
        image=str(config.get("Image") or "-"),
        container_id=container_id[:12] if container_id != "-" else "-",
        restart_count=str(inspect_data.get("RestartCount", "-")),
        exit_code=str(state.get("ExitCode", "-")),
        oom_killed=str(state.get("OOMKilled", "-")),
        started_at=format_docker_time(str(state.get("StartedAt") or "")),
        finished_at=format_docker_time(str(state.get("FinishedAt") or "")),
        uptime=calc_uptime(str(state.get("StartedAt") or ""), bool(state.get("Running"))),
        checked_at=checked_at,
        error=str(state.get("Error") or inspect_error or "-"),
    )


def lark_line(label: str, value: str) -> Any:
    return [{"tag": "text", "text": f"{label}：{value}"}]


def build_lark_payload(reports: List[ContainerReport]) -> Dict[str, Any]:
    """只聚合异常报告发到 Lark，避免每小时正常心跳刷屏影响告警可见性。"""
    if not reports:
        raise ValueError("reports cannot be empty")

    first = reports[0]
    checked_at = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")
    title = f"Docker 服务异常监控：{first.service_name}，异常容器 {len(reports)} 个"
    content = [
        lark_line("实例名称", first.instance_name),
        lark_line("服务名称", first.service_name),
        lark_line("异常容器数", str(len(reports))),
        lark_line("检测时间", checked_at),
    ]

    for index, report in enumerate(reports, start=1):
        content.extend(
            [
                lark_line("异常序号", str(index)),
                lark_line("容器名称", report.container_name),
                lark_line("实例状态", f"{report.level} / {report.status}"),
                lark_line("状态说明", report.status_detail),
                lark_line("Healthcheck", report.health),
                lark_line("镜像", report.image),
                lark_line("容器 ID", report.container_id),
                lark_line("重启次数", report.restart_count),
                lark_line("退出码", report.exit_code),
                lark_line("OOMKilled", report.oom_killed),
                lark_line("启动时间", report.started_at),
                lark_line("退出时间", report.finished_at),
                lark_line("已运行", report.uptime),
                lark_line("容器检测时间", report.checked_at),
            ]
        )
        if report.error and report.error != "-":
            content.append(lark_line("错误信息", report.error))

    return {
        "msg_type": "post",
        "content": {
            "post": {
                "zh_cn": {
                    "title": title,
                    "content": content,
                }
            }
        },
    }


def send_lark_message(webhook_url: str, payload: Dict[str, Any], timeout_seconds: int) -> None:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            response_body = response.read().decode("utf-8", errors="replace")
            status_code = response.status
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"lark webhook http error: status={exc.code}, body={body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"lark webhook request failed: {exc}") from exc

    if status_code >= 400:
        raise RuntimeError(f"lark webhook http status={status_code}, body={response_body}")

    try:
        response_json = json.loads(response_body)
    except json.JSONDecodeError:
        return

    code = response_json.get("code")
    status = response_json.get("StatusCode")
    if code not in (None, 0) or status not in (None, 0):
        raise RuntimeError(f"lark webhook returned failure: {response_body}")


def now_text() -> str:
    return datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")


def log_line(message: str, *, stderr: bool = False) -> None:
    target = sys.stderr if stderr else sys.stdout
    print(f"[{now_text()}] {message}", file=target, flush=True)


def parse_container_names(values: List[str]) -> List[str]:
    """支持多次传参和逗号分隔，方便 nohup 命令里一次监控多个容器。"""
    names: List[str] = []
    seen = set()
    for value in values:
        for raw_name in value.split(","):
            name = raw_name.strip()
            if not name or name in seen:
                continue
            names.append(name)
            seen.add(name)
    return names or DEFAULT_CONTAINER_NAMES


def collect_reports(args: argparse.Namespace, container_names: List[str]) -> List[ContainerReport]:
    reports: List[ContainerReport] = []
    for container_name in container_names:
        inspect_data, inspect_error = docker_inspect(args.docker_bin, container_name, args.docker_timeout_seconds)
        report = build_report(
            inspect_data=inspect_data,
            inspect_error=inspect_error,
            instance_name=args.instance_name,
            service_name=args.service_name,
            container_name=container_name,
        )
        reports.append(report)
    return reports


def run_check_cycle(args: argparse.Namespace, container_names: List[str]) -> int:
    reports = collect_reports(args, container_names)
    alert_reports = [report for report in reports if report.level != "正常"]

    for report in reports:
        log_line(
            "container={container} service={service} level={level} status={status} health={health} detail={detail}".format(
                container=report.container_name,
                service=report.service_name,
                level=report.level,
                status=report.status,
                health=report.health,
                detail=report.status_detail,
            )
        )

    # 正常状态只落本地日志，不推送 Lark，降低群消息噪声。
    if not alert_reports:
        log_line(f"all monitored containers are normal: count={len(reports)}")
        return 0

    payload = build_lark_payload(alert_reports)

    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    if not args.webhook_url:
        log_line("LARK_WEBHOOK_URL is required when abnormal containers exist", stderr=True)
        return 1

    try:
        send_lark_message(args.webhook_url, payload, args.lark_timeout_seconds)
    except RuntimeError as exc:
        log_line(str(exc), stderr=True)
        return 1

    alert_names = ",".join(report.container_name for report in alert_reports)
    log_line(f"sent lark alert: service={args.service_name}, alert_count={len(alert_reports)}, containers={alert_names}")
    return 0


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Monitor Docker containers hourly and send Lark alerts only on abnormal states.")
    container_default = os.getenv("DOCKER_CONTAINER_NAMES") or os.getenv("DOCKER_CONTAINER_NAME") or DEFAULT_CONTAINER_NAME
    parser.add_argument(
        "--container-name",
        action="append",
        default=None,
        help="container name to monitor; can be repeated or comma-separated",
    )
    parser.add_argument(
        "extra_container_names",
        nargs="*",
        help=argparse.SUPPRESS,
    )
    parser.add_argument("--service-name", default=os.getenv("MONITOR_SERVICE_NAME", DEFAULT_SERVICE_NAME))
    parser.add_argument("--instance-name", default=os.getenv("MONITOR_INSTANCE_NAME", socket.gethostname()))
    parser.add_argument("--webhook-url", default=os.getenv("LARK_WEBHOOK_URL", ""))
    parser.add_argument("--docker-bin", default=os.getenv("DOCKER_BIN", "docker"))
    parser.add_argument("--docker-timeout-seconds", type=positive_int, default=int(os.getenv("DOCKER_TIMEOUT_SECONDS", "10")))
    parser.add_argument("--lark-timeout-seconds", type=positive_int, default=int(os.getenv("LARK_TIMEOUT_SECONDS", "10")))
    parser.add_argument("--once", action="store_true", help="run one check cycle and exit, mainly for manual verification")
    parser.add_argument("--dry-run", action="store_true", help="run one check cycle and print Lark alert payload without sending it")
    parser.set_defaults(container_default=container_default)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    # shell 会把 `--container-name web-spider, oddfi-web-api-prod` 拆成两个参数；
    # 这里把尾部位置参数也纳入容器列表，兼容逗号后误加空格的线上命令。
    container_name_args = (args.container_name or [args.container_default]) + args.extra_container_names
    container_names = parse_container_names(container_name_args)
    log_line(
        "docker lark monitor started: service={service}, containers={containers}, interval_seconds={interval}".format(
            service=args.service_name,
            containers=",".join(container_names),
            interval=DEFAULT_INTERVAL_SECONDS,
        )
    )

    if args.once or args.dry_run:
        return run_check_cycle(args, container_names)

    # 默认常驻模式用于 nohup/systemd；间隔固定写在代码中，避免线上误传参数导致巡检频率失控。
    while True:
        exit_code = run_check_cycle(args, container_names)
        if exit_code == 1:
            log_line("monitor iteration failed; will retry after fixed interval", stderr=True)
        try:
            time.sleep(DEFAULT_INTERVAL_SECONDS)
        except KeyboardInterrupt:
            log_line("docker lark monitor stopped by keyboard interrupt")
            return 130


if __name__ == "__main__":
    sys.exit(main())
