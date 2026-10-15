docker login -u 你的名字

docker build -t web-spider:latest .
docker tag web-spider:latest 你的名字/web-spider:latest
docker push 你的名字/web-spider:latest 

# aws
sudo docker pull herongwei/web-spider:latest
sudo docker run -d  --log-opt max-size=1000m   --log-opt max-file=3  --name web-spider   --restart always   herongwei/web-spider:latest

# aws 服务监控
# nohup 常驻检查 Docker 容器 web-spider；每 3600 秒检测一次，只有异常才推送 Lark 群富文本消息。
# 详细说明见 docs/MONITORING.md。
export LARK_WEBHOOK_URL='https://open.larksuite.com/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
nohup python3 /opt/oddfi-web-spider/scripts/monitor_docker_lark.py \
  --container-name web-spider \
  --service-name oddfi-web-spider \
  --instance-name aws-web-spider-prod-1 \
  >> /var/log/web-spider-monitor.log 2>&1 &

# 多容器示例：
# nohup python3 /opt/oddfi-web-spider/scripts/monitor_docker_lark.py --container-name web-spider,web-api,web-settle --service-name oddfi-backend --instance-name aws-oddfi-prod-1 >> /var/log/web-spider-monitor.log 2>&1 &
