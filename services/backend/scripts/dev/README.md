# oddfi 本地开发环境（Docker Compose）

提供 MySQL 8.0 + Redis 7 供所有 oddfi-backend 服务共享使用。

## 启动

```bash
cd /Users/hang/work/oddfi-backend/scripts/dev
docker compose up -d
```

## 初始化数据库（首次启动后执行一次）

```bash
bash /Users/hang/work/oddfi-backend/scripts/dev/init-db.sh
```

## 停止

```bash
docker compose down
```

## 重置数据（销毁 volume，清空所有数据）

```bash
docker compose down -v
```

## 连接 MySQL

```bash
docker compose exec mysql mysql -uroot -p123456 oddfi_dev
```

## 连接 Redis

```bash
docker compose exec redis redis-cli
```

## 查看服务状态

```bash
docker compose ps
```

## 端口

| 服务  | 本地端口 |
|-------|---------|
| MySQL | 3306    |
| Redis | 6379    |
