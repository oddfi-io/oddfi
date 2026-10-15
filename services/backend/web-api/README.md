# Oddfi Web API 项目

## 项目介绍

Oddfi Web API 是一个基于 Go 语言和 Gin 框架开发的后端服务，主要提供用户认证、资产管理和下注相关的 API 接口。该服务支持钱包登录、资产查询、下注、撤单、持仓查询等功能，为前端应用提供完整的后端支持。

## 目录结构

```
web-api/
├── bin/             # 编译输出目录
├── cmd/             # 命令入口
│   └── server/      # 服务器启动入口
├── internal/        # 内部代码
│   ├── config/      # 配置管理
│   ├── handler/     # HTTP 处理器
│   ├── middleware/  # 中间件
│   ├── model/       # 数据模型
│   ├── pkg/         # 通用包
│   ├── repository/  # 数据仓库
│   ├── router/      # 路由管理
│   └── service/     # 业务逻辑
├── utils/           # 工具函数
├── config.yaml      # 配置文件
├── config_prod.yaml # 生产环境配置
├── go.mod           # Go 模块文件
└── go.sum           # 依赖校验文件
```

## 系统架构

系统采用分层架构设计：
- **路由层**：处理 HTTP 请求，路由到对应的处理器
- **处理器层**：处理业务逻辑，调用服务层
- **服务层**：实现核心业务逻辑
- **仓库层**：数据访问，与数据库交互
- **模型层**：定义数据结构

## API 接口说明

### 账户相关接口

| 接口路径 | 方法 | 功能描述 | 是否需要认证 |
|---------|------|---------|------------|
| `/account/login_by_wallet` | POST | 钱包登录 | 否 |
| `/account/refresh_access_token_by_refresh` | POST | 刷新访问令牌 | 否 |
| `/account/logout` | POST | 登出 | 是 |
| `/account/balance` | GET | 获取用户余额 | 是 |
| `/account/deposit_address` | GET | 获取用户存款地址 | 是 |
| `/account/asset_ledger` | GET | 获取资产 ledger | 是 |

### 下注相关接口

| 接口路径 | 方法 | 功能描述 | 是否需要认证 |
|---------|------|---------|------------|
| `/account/bet_place` | POST | 用户下注接口 | 是 |
| `/account/bet_cancel` | POST | 用户撤单接口 | 是 |
| `/account/bet_holding` | GET | 用户持仓接口 | 是 |
| `/account/bet_claim` | POST | 领取接口 | 是 |
| `/account/banner_bet_place` | POST | 首页 Banner 专用下注接口 | 是 |

### 接口参数说明

#### 登录接口 `/account/login_by_wallet`
- **请求参数**：
  ```json
  {
    "address": "string",
    "wallet_type": "string",
    "chain": "string",
    "session_id": "string",
    "message": "string",
    "signature": "string"
  }
  ```
- **响应参数**：
  ```json
  {
    "access_token": "string",
    "refresh_token": "string",
    "user_id": "string"
  }
  ```

#### 刷新访问令牌接口 `/account/refresh_access_token_by_refresh`
- **请求参数**：
  ```json
  {
    "refresh_token": "string"
  }
  ```
- **响应参数**：
  ```json
  {
    "access_token": "string",
    "refresh_token": "string"
  }
  ```

#### 登出接口 `/account/logout`
- **请求参数**：无（需要在请求头中携带 `Authorization: Bearer <access_token>`）
- **响应参数**：
  ```json
  {
    "message": "logged out successfully"
  }
  ```

#### 获取用户余额接口 `/account/balance`
- **请求参数**：无（需要在请求头中携带 `Authorization: Bearer <access_token>`）
- **响应参数**：
  ```json
  {
    "balance": "decimal"
  }
  ```

#### 获取用户存款地址接口 `/account/deposit_address`
- **请求参数**：无（需要在请求头中携带 `Authorization: Bearer <access_token>`）
- **响应参数**：
  ```json
  {
    "address": "string",
    "chain": "string"
  }
  ```

#### 获取资产 ledger 接口 `/account/asset_ledger`
- **请求参数**：
  - Query 参数：
    - `order_by`: 排序字段（可选，默认 "created_at"，可选值："created_at", "amount"）
    - `sort`: 排序方向（可选，默认 "asc"，可选值："asc", "desc"）
- **响应参数**：
  ```json
  {
    "ledger": [
      {
        "id": "uint64",
        "user_id": "uint64",
        "amount": "decimal",
        "type": "string",
        "created_at": "timestamp"
      }
    ]
  }
  ```

#### 下注接口 `/account/bet_place`
- **请求参数**：
  ```json
  {
    "type": "string", // single 或 parlay
    "odd_ids": [1, 2, 3],
    "stakes": ["100", "200", "300"], // 单位 odd 代币
    "ref_id": "string" // 相关id ref_id（可选）
  }
  ```
- **响应参数**：
  ```json
  {
    "results": [
      {
        "odd_id": "int64",
        "bet_id": "uint64",
        "status": "string", // "SUCCESS" 或 "FAILED"
        "error": "string" // 错误信息（可选）
      }
    ],
    "msg": "string", // "ALL_SUCCESS", "PARTIAL_SUCCESS", "FAILED"
    "error": "string" // 错误信息（可选）
  }
  ```

#### 撤单接口 `/account/bet_cancel`
- **请求参数**：
  ```json
  {
    "user_id": "uint64",
    "bet_ids": [1, 2, 3]
  }
  ```
- **响应参数**：
  ```json
  {
    "results": [
      {
        "bet_id": "uint64",
        "status": "string", // "SUCCESS" 或 "FAILED"
        "error": "string" // 错误信息（可选）
      }
    ],
    "msg": "string", // "ALL_SUCCESS", "PARTIAL_SUCCESS", "FAILED"
    "error": "string" // 错误信息（可选）
  }
  ```

#### 持仓接口 `/account/bet_holding`
- **请求参数**：无（需要在请求头中携带 `Authorization: Bearer <access_token>`）
- **响应参数**：
  ```json
  {
    "user_id": "uint64",
    "results": [
      {
        "odd_id": "int64",
        "stake": "decimal",
        "status": "string",
        "type": "string"
      }
    ]
  }
  ```

#### 领取接口 `/account/bet_claim`
- **请求参数**：
  ```json
  {
    "user_id": "uint64",
    "bet_id": "uint64"
  }
  ```
- **响应参数**：
  ```json
  {
    "amount": "decimal"
  }
  ```

## 技术栈

- **语言**：Go 1.25+
- **Web 框架**：Gin
- **数据库**：MySQL
- **缓存**：Redis
- **认证**：JWT
- **部署**：Docker

## 部署说明

1. **配置文件**：
   - 开发环境：`config.yaml`
   - 生产环境：`config_prod.yaml`
   - 注意统一通过配置文件中 `env` 来指定环境，默认值为 `dev` ，也可以通过环境变量 `ENV` 来指定环境，默认值为 `dev` 

2. **Docker 部署**：
   ```bash
   docker build -t web-api .
   docker run -d -p 80:80   --log-opt max-size=1000m   --log-opt max-file=3   --network host   --name account-web-api  web-api:dev
   ```

3. **直接运行**：
   ```bash
   go run cmd/server/main.go
   ```

## 开发环境搭建

1. **安装依赖**：
   ```bash
   go mod tidy
   ```

2. **运行服务**：
   ```bash
   go run cmd/server/main.go
   ```

3. **测试**：
   ```bash
   go test ./...
   ```

## 注意事项

- 所有需要认证的接口都需要在请求头中携带 `Authorization: Bearer <access_token>`
- 钱包登录目前只支持 BSC 链
- 下注接口支持单注和串注两种模式

## 联系我们

如有问题或建议，请联系项目维护者。