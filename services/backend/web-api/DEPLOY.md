# Docker 部署指南

本文档介绍如何使用 Docker 部署 web-api 服务。

## 目录

- [快速部署](#快速部署)
- [详细部署步骤](#详细部署步骤)
- [配置说明](#配置说明)
- [本地测试](#本地测试)
- [生产环境建议](#生产环境建议)

## 快速部署

### 构建镜像

```powershell
docker build -t web-api:latest .
```

### 运行容器

```powershell
docker run -d -p 80:80 --name web-api web-api:latest
```

### 验证部署

```powershell
curl http://localhost:80/health
```

## 详细部署步骤

### 1. 构建 Docker 镜像

在项目根目录执行：

```powershell
docker build -t web-api:latest .
```

### 2. 运行容器

基本运行命令：

```powershell
docker run -d -p 80:80 --name web-api web-api:latest
```

带环境变量的运行命令：

```powershell
docker run -d \
  -p 80:80 \
  --name web-api \
  -e DB_HOST=mysql-host \
  -e DB_PORT=3306 \
  -e DB_USER=root \
  -e DB_PASSWORD=your-password \
  -e DB_NAME=finance \
  -e REDIS_HOST=redis-host \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD=your-redis-password \
  -e JWT_SECRET=your-jwt-secret \
  web-api:latest
```

### 3. 查看日志

```powershell
docker logs -f web-api
```

### 4. 停止和删除容器

```powershell
docker stop web-api
docker rm web-api
```

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_HOST` | MySQL 主机地址 | localhost |
| `DB_PORT` | MySQL 端口 | 3306 |
| `DB_USER` | MySQL 用户名 | root |
| `DB_PASSWORD` | MySQL 密码 | - |
| `DB_NAME` | 数据库名称 | finance |
| `REDIS_HOST` | Redis 主机地址 | localhost |
| `REDIS_PORT` | Redis 端口 | 6379 |
| `REDIS_PASSWORD` | Redis 密码 | - |
| `JWT_SECRET` | JWT 密钥 | - |

### 端口映射

- 容器内部: 80
- 主机映射: 80 (可通过 `-p` 参数修改)

## 本地测试

如需在本地同时运行 MySQL 和 Redis 进行测试，可使用 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  web-api:
    build: .
    ports:
      - "80:80"
    environment:
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASSWORD=rootpassword
      - DB_NAME=finance
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - mysql
      - redis
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=finance
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

启动本地测试环境：

```powershell
docker-compose up -d
```

停止本地测试环境：

```powershell
docker-compose down
```

## 生产环境建议

### 1. 使用环境变量管理敏感信息

不要在命令行中直接传递密码，建议使用 Docker Secret 或环境变量文件。

### 2. 配置健康检查

容器已配置健康检查，可通过以下命令查看：

```powershell
docker inspect --format='{{.State.Health.Status}}' web-api
```

### 3. 日志管理

建议配置日志轮转，避免日志文件过大：

```powershell
docker run -d \
  -p 80:80 \
  --name web-api \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  web-api:latest
```

### 4. 资源限制

为容器设置资源限制：

```powershell
docker run -d \
  -p 80:80 \
  --name web-api \
  --memory="512m" \
  --cpus="1.0" \
  web-api:latest
```

### 5. 使用反向代理

生产环境建议使用 Nginx 或 Traefik 作为反向代理，配合 SSL 证书使用。

### 6. 监控

建议配置以下监控：
- 容器健康状态监控
- 应用日志收集 (如 ELK Stack)
- 性能指标监控 (如 Prometheus + Grafana)
