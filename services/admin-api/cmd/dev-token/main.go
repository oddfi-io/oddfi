// Package main 是本地开发用的 JWT 签发工具。
//
// 用途：跳过 OAuth 完整流程，直接给指定 lark_user_id 签一个 admin JWT，便于 curl 测试。
// **仅本地 dev 用**：生产部署不应包含此 cmd 二进制（make build 也别带上）。
//
// 用法：
//
//	go run ./cmd/dev-token -user ou_xxxxxx
//
// 输出：合法的 admin JWT，可直接 `Authorization: Bearer <token>` 调 /auth/me、/admin/*。
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm"

	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/config"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/jwt"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/mysql"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/pkg/redis"
	"github.com/Crypto-Barrett/oddfi-admin-backend/internal/repository"
)

func main() {
	larkUserID := flag.String("user", "", "lark_user_id (open_id) to sign token for")
	cfgPath := flag.String("config", "config.yaml", "path to config.yaml")
	flag.Parse()

	if *larkUserID == "" {
		fmt.Fprintln(os.Stderr, "usage: dev-token -user ou_xxxxxx")
		os.Exit(2)
	}

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		exit("load config: %v", err)
	}
	// stdout 必须只输出 JWT 以便 $() / shell 管道直接消费；日志全静音
	nopLog := zerolog.Nop()

	// 初始化依赖：MySQL（取 admin 记录） + Redis（JWT blacklist 需要）
	// 用独立 ctx 限制初始化阶段，避免冷启动 DNS / TLS 慢拖累后续业务调用
	initCtx, cancelInit := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelInit()

	db, dbClose, err := mysql.New(initCtx, cfg.MySQL, &nopLog)
	if err != nil {
		exit("mysql: %v", err)
	}
	defer func() { _ = dbClose() }()

	rdb, rdbClose, err := redis.New(initCtx, cfg.Redis, &nopLog)
	if err != nil {
		exit("redis: %v", err)
	}
	defer func() { _ = rdbClose() }()

	jwtSvc := jwt.New(cfg.JWT, rdb)
	repo := repository.NewAdminUser(db)

	// 业务调用走独立 ctx，预算不被初始化阶段消耗
	bizCtx, cancelBiz := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelBiz()

	admin, err := repo.FindByLarkUserID(bizCtx, *larkUserID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			exit("admin not found: lark_user_id=%s 不在 admin_users 表里", *larkUserID)
		}
		exit("find admin: %v", err)
	}

	token, jti, exp, err := jwtSvc.Sign(bizCtx, admin)
	if err != nil {
		exit("sign: %v", err)
	}

	fmt.Fprintf(os.Stderr, "✅ token signed for lark_user_id=%s name=%s role=%s\n",
		admin.LarkUserID, admin.LarkName, admin.Role)
	fmt.Fprintf(os.Stderr, "   jti=%s exp=%s\n", jti, exp.Format(time.RFC3339))
	fmt.Println(token)
}

func exit(format string, a ...any) {
	fmt.Fprintf(os.Stderr, "✗ "+format+"\n", a...)
	os.Exit(1)
}
