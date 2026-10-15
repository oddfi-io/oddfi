# Let's Encrypt 自动续期 Hooks（DD-003 admin-api.oddfi.io）

## 背景

`admin-api.oddfi.io` 的 TLS 证书由 certbot **standalone 模式**签发：

```bash
sudo certbot certonly --standalone -d admin-api.oddfi.io \
  --agree-tos --email ops@example.com -n
```

standalone 模式需要 certbot 临时监听 `:80`，与 host network 模式的 web-api 容器（也在 :80）冲突。因此每次签发和续期都要先停 web-api 容器，签完再启回。

certbot 自带 systemd timer 每 12h 跑一次 `certbot renew`，距离过期 < 30 天才真正续期。本目录的两个 hook 在续期前后自动停启 web-api。

## 部署到 prod EC2

```bash
# 工作机本地：scp 两个脚本上去
scp web-api/deploy/letsencrypt-hooks/pre-stop-web-api.sh \
    oddfi-backend:/tmp/pre-stop-web-api.sh
scp web-api/deploy/letsencrypt-hooks/post-start-web-api.sh \
    oddfi-backend:/tmp/post-start-web-api.sh

# ssh 上去 install + chmod
ssh oddfi-backend
sudo install -m 755 -o root -g root /tmp/pre-stop-web-api.sh  /etc/letsencrypt/renewal-hooks/pre/stop-web-api.sh
sudo install -m 755 -o root -g root /tmp/post-start-web-api.sh /etc/letsencrypt/renewal-hooks/post/start-web-api.sh

# 干跑一次验证 hook 能跑
sudo certbot renew --dry-run
# 期望：先停 web-api，验证 cert renewal 流程，再启 web-api
```

## 验证 hook 已就位

```bash
ssh oddfi-backend "ls -la /etc/letsencrypt/renewal-hooks/{pre,post}/"
# 期望：pre/stop-web-api.sh + post/start-web-api.sh 都 -rwxr-xr-x
```

## 停机预期

每 ~60 天续期一次（cert 90 天有效，certbot 在 ≤30 天时续）：
- `pre/stop-web-api.sh` 执行：~2s（docker stop）
- certbot 续期 + 签发：~5s
- `post/start-web-api.sh` 执行：~3s
- **每次 ~10s api.oddfi.io HTTP 不可用**（admin-api.oddfi.io 期间也不可用，但 nginx 那时已不依赖 :80 故无影响）

## 监控

systemd timer 自动运行，无 stdout/stderr 输出。如需查看：
```bash
sudo journalctl -u certbot.timer
sudo journalctl -u certbot.service --since "1 hour ago"
```

cert 过期前 14 天，Let's Encrypt 会发邮件到 `ops@example.com`。如果收到，说明续期可能失败，应立即手动跑：
```bash
sudo certbot renew --dry-run   # 看错误
sudo certbot renew             # 实际续
```

## 关联

- DD-003 cutover-dd003.md §3.3 / §3.4
- ADR-0004 web-api EC2 部署架构
