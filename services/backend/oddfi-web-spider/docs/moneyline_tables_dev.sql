-- Moneyline 历史快照表和采集状态表，测试环境 project_oddfi_dev 执行。
-- 这里使用 IF NOT EXISTS，方便在 GORM AutoMigrate 已经创建过表的环境重复执行验证。

CREATE TABLE IF NOT EXISTS oddfi_moneyline_snapshots (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  fixture_id      BIGINT       NOT NULL                COMMENT 'SportMonks fixture id',
  market_id       INT          NOT NULL DEFAULT 1      COMMENT '固定 1 = Fulltime Result',
  bookmaker_id    INT          NOT NULL                COMMENT '20 = Bet365（与现 spider 一致）',
  label           VARCHAR(8)   NOT NULL                COMMENT 'Home / Draw / Away',
  value           DECIMAL(8,3) NOT NULL                COMMENT 'decimal odds',
  probability     DECIMAL(6,3) NOT NULL                COMMENT '隐含概率 %（SportMonks 原始值，缺失时由 1/odds 兜底）',
  normalized_pct  DECIMAL(6,3) NOT NULL                COMMENT '三方 over-round 消除后的归一化概率 %',
  state_id        INT          NOT NULL                COMMENT '采集瞬间的 fixture state_id',
  captured_at     DATETIME(3)  NOT NULL                COMMENT '采集时刻（毫秒精度避免同秒多笔冲突）',
  PRIMARY KEY (id),
  KEY idx_fid_label_time (fixture_id, label, captured_at),
  KEY idx_captured_at (captured_at),
  KEY idx_fid_time (fixture_id, captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Moneyline 历史快照';

CREATE TABLE IF NOT EXISTS oddfi_moneyline_collection_status (
  fixture_id        BIGINT       NOT NULL,
  status            ENUM('PENDING','POLLING','COMPLETED','STOPPED','ANOMALY') NOT NULL DEFAULT 'PENDING',
  first_captured_at DATETIME(3)  NULL,
  last_captured_at  DATETIME(3)  NULL,
  last_state_id     INT          NULL,
  capture_count     INT          NOT NULL DEFAULT 0,
  next_poll_at      DATETIME(3)  NULL                  COMMENT '下次应该采集的时刻（驱动调度）',
  notes             TEXT         NULL,
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (fixture_id),
  KEY idx_status_next (status, next_poll_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Moneyline 采集状态机';
