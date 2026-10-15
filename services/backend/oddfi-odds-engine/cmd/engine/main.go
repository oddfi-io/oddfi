package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"oddfi-odds-engine/internal/api"
	"oddfi-odds-engine/internal/engine"
	"oddfi-odds-engine/internal/model"
	"oddfi-odds-engine/internal/storage"
)

func main() {
	// 1. 初始化配置 (RDS 连接字符串)
	dsn := "user:pass@tcp(rds-endpoint:3306)/oddfi_db?charset=utf8mb4&parseTime=True&loc=Local"

	log.Println("🚀 OddFi Odds Engine 正在启动...")

	// 2. 初始化存储
	store := storage.NewDBStorage(dsn)
	db := store.GetDB()

	// 3. 初始化 WebSocket 广播中心
	wsHub := api.NewWSHub()
	go wsHub.Run()

	// 4. 初始化异步计算引擎 (Worker)
	// 修改为结构化信号通道
	betEventQueue := make(chan model.BetSignal, 1000)
	oddsWorker := engine.NewOddsWorker(db, wsHub.GetBroadcastChan())

	// 启动消费者：处理赔率重算
	go func() {
		log.Println("👷 Odds Worker 消费者已就绪...")
		for sig := range betEventQueue {
			err := oddsWorker.HandleBetEvent(sig.FixtureID, sig.MarketID, sig.BookmakerID)
			if err != nil {
				log.Printf("❌ 赔率重算失败: %v", err)
			}
		}
	}()

	// 5. 设置 HTTP 路由
	r := gin.Default()

	// 路由 A: WebSocket
	r.GET("/ws", func(c *gin.Context) {
		wsHub.ServeWS(c.Writer, c.Request)
	})

	// 路由 B: 赔率预览
	handler := &api.OddsHandler{}
	r.POST("/api/v1/bets/preview", handler.GetBetPreview)

	// 路由 C: 真实下注接口 (包含 bets 表更新逻辑)
	r.POST("/api/v1/bets/place", func(c *gin.Context) {
		// 这里接收前端传来的 OddID (即 odds 表的主键) 和金额
		oddIDStr := c.PostForm("odd_id")
		stakeStr := c.PostForm("stake")
		userID := c.DefaultPostForm("user_id", "guest_001")

		oddID, _ := strconv.ParseInt(oddIDStr, 10, 64)
		stake, _ := strconv.ParseFloat(stakeStr, 64)

		if oddID == 0 || stake <= 0 {
			c.JSON(400, gin.H{"error": "invalid odd_id or stake"})
			return
		}

		// --- 核心：更新 bets 表与 odds.total_stake ---
		var targetOdd model.Odd
		err := db.Transaction(func(tx *gorm.DB) error {
			// 1. 悲观锁锁定该赔率行，防止并发下注导致 Stake 统计丢失
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				First(&targetOdd, oddID).Error; err != nil {
				return err
			}

			// 2. 累加 odds 表中的总投注额 (S_i)
			if err := tx.Model(&targetOdd).Update("total_stake", gorm.Expr("total_stake + ?", stake)).Error; err != nil {
				return err
			}

			// 3. 写入 bets 交易记录表
			newBet := model.Bet{
				ID:              strconv.FormatInt(time.Now().UnixNano(), 10), // 简单生成ID
				UserID:          userID,
				OddID:           targetOdd.ID,
				FixtureID:       targetOdd.FixtureID,
				MarketID:        targetOdd.MarketID,
				BookmakerID:     targetOdd.BookmakerID,
				Selection:       targetOdd.Label,
				Stake:           stake,
				OddsAtBet:       targetOdd.CurrentValue, // 记录下单时的赔率快照
				PotentialPayout: stake * targetOdd.CurrentValue,
				Status:          "pending",
			}
			return tx.Create(&newBet).Error
		})

		if err != nil {
			log.Printf("❌ 下注事务失败: %v", err)
			c.JSON(500, gin.H{"error": "place bet failed"})
			return
		}

		// 4. 事务成功后，触发异步重算
		betEventQueue <- model.BetSignal{
			FixtureID:   targetOdd.FixtureID,
			MarketID:    targetOdd.MarketID,
			BookmakerID: targetOdd.BookmakerID,
		}

		c.JSON(200, gin.H{
			"status": "success",
			"bet_id": time.Now().UnixNano(),
			"payout": stake * targetOdd.CurrentValue,
		})
	})

	// 6. 启动与优雅停机 (保持原样...)
	srv := &http.Server{Addr: ":8080", Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
