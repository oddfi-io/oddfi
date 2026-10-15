# EC2 一次性 bootstrap runbook

> 目标机：`oddfi-admin` (`<SERVER_IP>`)，Ubuntu 26.04 LTS，独立机器（**不**与 C 端 web-api 共享 MySQL/Redis）。
>
> 范围：从零 EC2 → Go 后端 + MySQL + Redis + Nginx 全部运行 + 首个 super_admin 建好 + 前端 SPA 静态目录就绪。
>
> 整合原 OPS-02（systemd）+ OPS-03（DB bootstrap）+ OPS-04（Nginx + TLS）三个任务为一份连贯 runbook，便于一次性部署。后续增量变更走 [`§9 增量发版`](#9-增量发版)。

---

## 0. 准备清单（本地 + Lark + DNS）

- [x] Lark 应用 `oddfi-admin` 已发布（OPS-01）
- [x] `~/.ssh/admin-server-key.pem` 配置好，`ssh oddfi-admin` 能登（SSH 别名见 `~/.ssh/SERVERS.md`）
- [x] 本地拥有 Lark App Secret（**不**通过 AI/scp 传输；EC2 上 sudoedit 手填）
- [ ] DNS：`admin.oddfi.io` A 记录指向 `<SERVER_IP>`（TLS 必需）
- [ ] AWS Security Group：放行 :22（限制源 IP）、:80、:443；**不**对外开 :8081 / :3306 / :6379
- [ ] 前端构建产物 `oddfi-admin-frontend/dist/` 准备好（`npm run build`）

## 1. 系统基础

```bash
ssh oddfi-admin
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone UTC
sudo apt install -y curl jq ufw rsync
```

防火墙（OS 层兜底，security group 是主防线）：

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```

## 2. MySQL 8

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo mysql_secure_installation   # 全部 Y；root 密码先存密码管理器
```

调优（2 GB RAM 紧；关掉 performance_schema 省 ~200MB）：

```bash
sudo tee /etc/mysql/mysql.conf.d/oddfi-admin.cnf > /dev/null << 'EOF'
[mysqld]
bind-address = 127.0.0.1
performance_schema = OFF
innodb_buffer_pool_size = 256M
max_connections = 100
character-set-server = utf8mb4
collation-server = utf8mb4_0900_ai_ci
default-time-zone = '+00:00'
EOF
sudo systemctl restart mysql
sudo systemctl status mysql --no-pager
```

### 2.1 建库 + 建账号 + 跑 migration

```bash
# 先用 root 建库 + admin 账号（admin 账号只能访问 oddfi_admin）
sudo mysql << 'EOF'
CREATE DATABASE IF NOT EXISTS oddfi_admin
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'admin'@'127.0.0.1' IDENTIFIED BY 'REPLACE_ME_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON oddfi_admin.* TO 'admin'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF
```

**注意**：`REPLACE_ME_STRONG_PASSWORD` 用 `openssl rand -base64 24` 生成，存进密码管理器；不要进 shell history（命令前空格）。

scp migration 文件上去再跑：

```bash
# 本机
scp migrations/0001_create_admin_users.sql oddfi-admin:/tmp/

# EC2
mysql -u admin -p oddfi_admin < /tmp/0001_create_admin_users.sql
mysql -u admin -p -e "SHOW TABLES;" oddfi_admin
# 期望：admin_users
```

### 2.2 插入首个 super_admin（bootstrap，无法走 Lark OAuth）

```bash
# Lark user_id 来自 docs/lark-app-binding.md 或自己 OAuth 一次拿（Hank: ou_12d3776bcf5f20c5289d3cd0767aade1）
mysql -u admin -p oddfi_admin << 'EOF'
INSERT INTO admin_users (lark_user_id, lark_name, lark_email, role, created_by)
VALUES (
  'ou_12d3776bcf5f20c5289d3cd0767aade1',
  'Hank',
  'ops@example.com',
  'super_admin',
  'BOOTSTRAP'
);
SELECT lark_user_id, lark_name, role FROM admin_users;
EOF
```

之后所有 admin 增删走 `super_admin` 在前端 `/admin/admin-users` 页面操作。

## 3. Redis

```bash
sudo apt install -y redis-server

# 绑定本机 + 限内存
sudo tee /etc/redis/redis.conf.d/oddfi-admin.conf > /dev/null << 'EOF'
bind 127.0.0.1
protected-mode yes
maxmemory 128mb
maxmemory-policy allkeys-lru
EOF
# Ubuntu redis 包默认 include /etc/redis/redis.conf.d/*.conf；不确认就检查：
grep -i "include" /etc/redis/redis.conf | head -5
# 如果没 include 行，手动 sudo sed -i 's|^bind .*|bind 127.0.0.1|' /etc/redis/redis.conf

sudo systemctl restart redis-server
sudo systemctl enable redis-server
redis-cli ping
# 期望：PONG
```

## 4. oddfi 系统用户 + 目录

```bash
sudo useradd -r -s /usr/sbin/nologin oddfi
sudo mkdir -p /etc/oddfi-admin /var/lib/oddfi-admin /var/log/oddfi-admin /var/www/oddfi-admin
sudo chown oddfi:oddfi /var/lib/oddfi-admin /var/log/oddfi-admin
sudo chown root:root /etc/oddfi-admin && sudo chmod 750 /etc/oddfi-admin
```

`/var/www/oddfi-admin` 是前端 SPA 静态文件目录，Nginx 直接服务。

## 5. 本地构建 + 上传

```bash
# 本机（mac arm64 → linux amd64 交叉编译）
cd ~/work/oddfi-admin-backend
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bin/admin-server-linux ./cmd/server
ls -la bin/admin-server-linux

# 上传二进制 + systemd unit + env 模板 + config 模板
scp bin/admin-server-linux             oddfi-admin:/tmp/oddfi-admin-server.new
scp deploy/oddfi-admin-server.service  oddfi-admin:/tmp/
scp deploy/env.production.example      oddfi-admin:/tmp/
scp config.example.yaml                oddfi-admin:/tmp/
scp deploy/nginx.conf.example          oddfi-admin:/tmp/

# 前端 SPA（如果本次同步部署）
cd ~/work/oddfi-admin-frontend
npm run build
rsync -avz --delete dist/ oddfi-admin:/tmp/oddfi-admin-frontend-dist/
```

## 6. 部署二进制 + config.yaml + env.production

### 6.1 二进制

```bash
ssh oddfi-admin
sudo install -m 755 -o root -g root /tmp/oddfi-admin-server.new /usr/local/bin/oddfi-admin-server
/usr/local/bin/oddfi-admin-server -help 2>&1 | head -5
# 期望看到 -config flag
```

### 6.2 config.yaml（非敏感字段）

```bash
sudo install -m 640 -o root -g oddfi /tmp/config.example.yaml /etc/oddfi-admin/config.yaml
sudoedit /etc/oddfi-admin/config.yaml
```

需要改的字段：
- `server.env: prod`
- `logger.pretty: false`
- `redis.db: 1`（与未来共享 redis 避免 key 冲突）
- `lark.redirect_uri: https://admin.oddfi.io/auth/lark/callback`
- `cors.allowed_origins: ["https://admin.oddfi.io"]`（移除 localhost）
- `frontend.callback_url: https://admin.oddfi.io/`

敏感字段（`mysql.dsn` / `jwt.secret` / `lark.app_secret`）保留占位，env 会覆盖。

### 6.3 env.production（敏感字段）

```bash
# 生成 JWT secret（在 EC2 上跑，避免经过本机/AI 上下文）
openssl rand -base64 48
# 复制输出

sudo install -m 600 -o root -g root /tmp/env.production.example /etc/oddfi-admin/env.production
sudoedit /etc/oddfi-admin/env.production
```

填入：
- `ADMIN_DB_DSN=admin:<§2.1 的 DB 密码>@tcp(127.0.0.1:3306)/oddfi_admin?charset=utf8mb4&parseTime=true&loc=Local&timeout=5s`
- `ADMIN_JWT_SECRET=<上一步 openssl 输出>`
- `ADMIN_LARK_APP_ID=<LARK_APP_ID>`
- `ADMIN_LARK_APP_SECRET=<Lark 后台拷过来>`
- `ADMIN_REDIS_ADDR=127.0.0.1:6379`
- `ADMIN_REDIS_PASSWORD=`（Redis 没设密码）
- `ADMIN_FRONTEND_URL=https://admin.oddfi.io/`

**验证权限**：

```bash
ls -la /etc/oddfi-admin/
# config.yaml: -rw-r----- root:oddfi
# env.production: -rw------- root:root
```

## 7. systemd unit + 启动

```bash
sudo install -m 644 -o root -g root /tmp/oddfi-admin-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable oddfi-admin-server
sudo systemctl start  oddfi-admin-server
sleep 2
sudo systemctl status oddfi-admin-server --no-pager
sudo journalctl -u oddfi-admin-server -n 50 --no-pager
```

期望：`active (running)` + journal 看到 `mysql connected` `redis connected` `admin server listening :8081`。

```bash
# 本机健康检查（:8081 只 127.0.0.1 监听）
curl -s http://127.0.0.1:8081/health | jq .
# {"code":0,"message":"ok","data":{"status":"ok"}}
```

## 8. Nginx + TLS

### 8.1 部署前端 SPA

```bash
sudo rsync -avz --delete /tmp/oddfi-admin-frontend-dist/ /var/www/oddfi-admin/
sudo chown -R www-data:www-data /var/www/oddfi-admin
```

### 8.2 装 Nginx

```bash
sudo apt install -y nginx
sudo install -m 644 -o root -g root /tmp/nginx.conf.example /etc/nginx/sites-available/admin.oddfi.io
sudo ln -sf /etc/nginx/sites-available/admin.oddfi.io /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 8.3 TLS（Let's Encrypt）

**前提**：DNS A 记录 `admin.oddfi.io` → `<SERVER_IP>` 已生效（`dig admin.oddfi.io` 解析正确）。

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d admin.oddfi.io --non-interactive --agree-tos --email ops@example.com --redirect
sudo systemctl status certbot.timer  # 自动续期
```

## 9. 验收

```bash
# DNS
dig +short admin.oddfi.io
# <SERVER_IP>

# HTTPS 健康
curl -sI https://admin.oddfi.io/health
curl -s  https://admin.oddfi.io/health | jq .
# {"code":0,"data":{"status":"ok"}}

# SPA 路由（应返回 index.html，code 200，content-type text/html）
curl -sI https://admin.oddfi.io/
curl -sI https://admin.oddfi.io/some-spa-route   # 应该也返回 index.html（fallback）

# OAuth 入口（应该 302 到 Lark）
curl -sI https://admin.oddfi.io/auth/lark/login

# 浏览器：https://admin.oddfi.io → 点 "Lark 登录" → 走完整流程
```

## 10. 增量发版

后端：

```bash
# 本机
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o bin/admin-server-linux ./cmd/server
scp bin/admin-server-linux oddfi-admin:/tmp/oddfi-admin-server.new

# EC2
sudo install -m 755 -o root -g root /tmp/oddfi-admin-server.new /usr/local/bin/oddfi-admin-server
sudo systemctl restart oddfi-admin-server
sudo journalctl -u oddfi-admin-server -n 50 --no-pager
```

前端：

```bash
# 本机
cd ~/work/oddfi-admin-frontend && npm run build
rsync -avz --delete dist/ oddfi-admin:/tmp/oddfi-admin-frontend-dist/

# EC2
sudo rsync -avz --delete /tmp/oddfi-admin-frontend-dist/ /var/www/oddfi-admin/
sudo chown -R www-data:www-data /var/www/oddfi-admin
# 不需要 reload nginx（静态文件）
```

DB migration：

```bash
# 本机
scp migrations/0002_xxx.sql oddfi-admin:/tmp/

# EC2
mysql -u admin -p oddfi_admin < /tmp/0002_xxx.sql
mysql -u admin -p oddfi_admin -e "SHOW TABLES;"
# 同步 commit 一份 migration 到 main
```

## 11. 安全注意

- `:8081` `:3306` `:6379` 必须只监听 `127.0.0.1`，security group + ufw 也不开外
- `ADMIN_LARK_APP_SECRET` / `ADMIN_JWT_SECRET` / DB 密码 不要 `echo`，命令前加空格防进 history
- `/etc/oddfi-admin/env.production` 必须 `chmod 600 root:root`
- Secret 轮换：见 [`docs/lark-app-binding.md §9`](../docs/lark-app-binding.md)
- 备份策略（TODO）：MySQL `oddfi_admin` DB 每天 dump 到 S3，保留 30 天

## 12. 故障速查

| 现象 | 原因 | 修 |
|---|---|---|
| `mysql.dsn is required` | env 没生效 / DSN 占位没填 | `sudo systemctl show oddfi-admin-server -p Environment` 看是否注入 |
| `jwt.secret must be ≥ 32 bytes` | `openssl rand -base64 48` 输出被截断 | 重跑 + 直接 sudoedit 粘贴 |
| `Access denied for user 'admin'@'localhost'` | §2.1 DB 用户没建 / 密码错 | `mysql -u admin -p oddfi_admin` 手测 |
| `lark.redirect_uri required` | §6.2 漏改 config.yaml | sudoedit /etc/oddfi-admin/config.yaml |
| HTTPS 通但 OAuth 跳 404 | Nginx 没把 `/auth/*` 反代给 :8081 | 看 `/etc/nginx/sites-enabled/admin.oddfi.io` location 块 |
| Lark "redirect_uri 不在白名单" | Lark 后台与 config.yaml 字符串不完全一致 | 核对 https vs http / 末尾斜杠 |
| OAuth 完成 302 回 `/auth/lark/callback` 又被 Nginx 路由给后端 | `frontend.callback_url` 与 `lark.redirect_uri` 路径重叠 | 把 frontend URL 改成 `/` 或 `/login` |
