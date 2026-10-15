# 多环境配置指南

本文档详细说明了 Chain Crawler 项目的多环境配置方案。

## 📋 概述

Chain Crawler 支持 5 种不同的运行环境，每个环境都有独立的配置文件：

| 环境 | 配置文件 | 用途 | 部署方式 |
|------|----------|------|----------|
| `local` | `chaincrawler.local.toml` | 本地开发 | 直接运行 |
| `dev` | `chaincrawler.dev.toml` | 开发环境 | Jenkins + Docker |
| `test` | `chaincrawler.test.toml` | 测试环境 | Jenkins + Kubernetes |
| `pre` | `chaincrawler.pre.toml` | 预生产环境 | Jenkins + Kubernetes |
| `prod` | `chaincrawler.prod.toml` | 生产环境 | Jenkins + Kubernetes |

## 🚀 快速开始

### 环境变量设置

通过设置环境变量来指定运行环境：

```bash
# 方式1: 设置 APP_ENV
export APP_ENV=dev

# 方式2: 设置 ENVIRONMENT
export ENVIRONMENT=test

# 方式3: 设置 ENV
export ENV=prod

# 优先级：APP_ENV > ENVIRONMENT > ENV > default(local)
```

### 本地开发

```bash
# 使用本地配置运行
make run

# 或显式指定本地环境
APP_ENV=local make run

# 使用部署脚本
./scripts/deploy.sh local build
./scripts/deploy.sh local deploy
```

### 不同环境运行

```bash
# 开发环境
make run-dev
# 或
APP_ENV=dev go run cmd/chain_crawler/main.go

# 测试环境
make run-test
# 或
APP_ENV=test go run cmd/chain_crawler/main.go

# 预生产环境
make run-pre

# 生产环境
make run-prod
```

## 📁 配置文件结构

所有配置文件都位于 `configs/` 目录下，使用 TOML 格式：

```
configs/
├── chaincrawler.local.toml     # 本地开发环境
├── chaincrawler.dev.toml       # 开发环境
├── chaincrawler.test.toml      # 测试环境
├── chaincrawler.pre.toml       # 预生产环境
├── chaincrawler.prod.toml      # 生产环境
└── config.yaml.example         # YAML格式示例（已废弃）
```

### 配置文件模板

每个配置文件包含以下主要部分：

```toml
[app]
name = "chain_crawler"
version = "1.0.0"
environment = "local"  # 当前环境标识
debug = true

[server]
port = 8080
host = "0.0.0.0"
gin_mode = "debug"

[logging]
level = "debug"
format = "text"
file = "logs/app.log"

[database]
host = "localhost"
port = 5432
name = "chain_crawler_local"
user = "postgres"
password = "password"

[redis]
host = "localhost"
port = 6379
password = ""

[blockchain.ethereum]
rpc_url = "https://mainnet.infura.io/v3/YOUR_PROJECT_ID"
chain_id = 1

# ... 更多配置项
```

## 🔧 环境配置详情

### Local (本地开发)

**特点：**
- 调试模式开启
- 详细日志输出
- 本地数据库和Redis
- 较低的性能配置
- 启用所有调试功能

**典型配置：**
```toml
[app]
environment = "local"
debug = true

[logging]
level = "debug"
format = "text"
console_output = true

[debug]
enabled = true
profile_enabled = true
pprof_enabled = true
verbose = true
```

### Dev (开发环境)

**特点：**
- 适度的性能配置
- JSON格式日志
- 外部数据库和Redis
- 启用监控
- 通知集成

**典型配置：**
```toml
[app]
environment = "dev"
debug = true

[logging]
level = "info"
format = "json"
console_output = true

[database]
host = "postgres-dev"
max_connections = 50

[monitoring]
prometheus_enabled = true
grafana_enabled = true
```

### Test (测试环境)

**特点：**
- 较高的性能配置
- 完整的监控和告警
- 严格的安全配置
- 完整的测试覆盖

**典型配置：**
```toml
[app]
environment = "test"
debug = false

[server]
gin_mode = "release"

[logging]
level = "info"
console_output = false

[security]
rate_limit.requests = 300
cors_origins = ["https://test-frontend.company.com"]
```

### Pre (预生产环境)

**特点：**
- 接近生产的配置
- 完整的监控和告警
- 严格的安全策略
- 性能优化

**典型配置：**
```toml
[app]
environment = "pre"
debug = false

[logging]
level = "warn"
max_age = 30
max_backups = 20

[crawler]
concurrent_limit = 20
rate_limit = 500
batch_size = 500

[security]
rate_limit.requests = 200
```

### Prod (生产环境)

**特点：**
- 最高性能配置
- 最严格的安全策略
- 最少的日志输出
- 最大的资源配置

**典型配置：**
```toml
[app]
environment = "prod"
debug = false

[logging]
level = "error"
max_age = 90
max_backups = 50

[crawler]
concurrent_limit = 50
rate_limit = 2000
batch_size = 1000

[security]
rate_limit.requests = 100
jwt_expiration = "4h"

[performance]
max_concurrent_requests = 5000
max_heap_size = "8GB"
```

## 🔄 Jenkins 流水线集成

### 触发方式

1. **手动触发：** 在 Jenkins 界面选择环境和操作类型
2. **Git 推送触发：**
   - `dev` 分支 → 自动部署到 dev 环境
   - `test` 分支 → 自动部署到 test 环境
   - `main` 分支 → 手动部署到 pre/prod 环境

### 流水线参数

```groovy
parameters {
    choice(
        name: 'ENVIRONMENT',
        choices: ['dev', 'test', 'pre', 'prod'],
        description: '选择部署环境'
    )
    choice(
        name: 'BUILD_TYPE',
        choices: ['build', 'deploy', 'rollback'],
        description: '选择操作类型'
    )
}
```

### 配置文件验证

Jenkins 流水线会自动验证对应环境的配置文件：

```bash
# 检查配置文件是否存在
if [[ ! -f "configs/chaincrawler.${ENVIRONMENT}.toml" ]]; then
    echo "配置文件不存在: configs/chaincrawler.${ENVIRONMENT}.toml"
    exit 1
fi
```

## 🛠️ 配置管理最佳实践

### 1. 敏感信息管理

**不要在配置文件中直接存储敏感信息：**

```toml
# ❌ 错误方式
[database]
password = "real_production_password"

# ✅ 正确方式
[database]
password = "REPLACE_WITH_ENV_VAR"
```

**使用环境变量覆盖：**

```bash
export DB_PASSWORD="real_production_password"
export REDIS_PASSWORD="real_redis_password"
```

### 2. 配置文件版本控制

- ✅ 提交模板配置文件（去除敏感信息）
- ✅ 使用 `.gitignore` 排除实际配置文件
- ✅ 在部署时注入敏感配置

### 3. 配置验证

在应用启动时验证配置：

```go
func main() {
    cfg := config.LoadConfig()
    if err := config.ValidateConfig(cfg); err != nil {
        log.Fatalf("配置验证失败: %v", err)
    }
}
```

### 4. 配置文档

- 为每个配置项添加注释
- 说明配置项的作用和可选值
- 提供示例值

## 🔍 故障排查

### 常见问题

1. **配置文件未找到**
   ```
   ERROR: 配置文件不存在: configs/chaincrawler.dev.toml
   ```
   **解决方案：** 检查文件路径和环境变量设置

2. **配置解析失败**
   ```
   ERROR: 解析配置文件失败: toml: line 10: expected '=' after key
   ```
   **解决方案：** 检查TOML语法，确保格式正确

3. **环境变量未生效**
   ```
   WARNING: 使用默认配置
   ```
   **解决方案：** 检查环境变量设置和优先级

### 调试方法

1. **查看当前配置：**
   ```bash
   # 运行应用时会显示加载的配置文件
   APP_ENV=dev go run cmd/chain_crawler/main.go
   # 输出: 成功加载配置文件: configs/chaincrawler.dev.toml (环境: dev)
   ```

2. **验证配置文件语法：**
   ```bash
   # 使用 toml 验证工具
   toml-lint configs/chaincrawler.dev.toml
   ```

3. **环境变量检查：**
   ```bash
   echo $APP_ENV
   echo $ENVIRONMENT
   echo $ENV
   ```

## 📚 相关文档

- [部署指南](DEPLOYMENT.md)
- [Jenkins 配置](JENKINS.md)
- [监控配置](MONITORING.md)
- [安全配置](SECURITY.md)

## 🤝 贡献指南

添加新环境或修改配置时，请：

1. 复制现有配置文件作为模板
2. 根据环境特点调整配置值
3. 更新此文档
4. 测试配置文件的有效性
5. 提交 Pull Request

## 📞 支持

如有配置相关问题，请：

1. 查看[故障排查](#故障排查)部分
2. 检查[常见问题](#常见问题)
3. 提交 Issue 或联系开发团队 