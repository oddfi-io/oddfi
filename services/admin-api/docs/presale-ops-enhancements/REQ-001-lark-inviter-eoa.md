# REQ-001: Lark 推送消息展示邀请人 EOA 地址

**归属仓库**: `oddfi-backend/web-api`
**优先级**: P1
**负责人**: web-api agent

---

## 背景

当前 Lark 机器人在用户成功入金时推送如下卡片：

```
🎉 认购到账：用户成功入金

EOA: 0x55193beb65fcbf81ebfd840d5249b40e550306a4
金额: 0.01 USDT
获得 ODD: 0.2
轮次: strategic
邀请人: uid=204217720615440384
txHash: 0x61e0...
```

运营需要在卡片里直接看到邀请人的 EOA 钱包地址，方便快速识别 KOL 身份，无需再去数据库查。

---

## 需求

`deposit_confirmed` 事件的 Lark 卡片消息新增一行 **邀请人EOA**，展示在 `邀请人` 行之后：

```
邀请人: uid=204217720615440384
邀请人EOA: 0xabc...def
```

无邀请人时两行均不显示（保持现有逻辑：`Referrer` 为空时显示 `-`）。
有邀请人但 EOA 为 null（极罕见）时，`邀请人EOA` 显示 `-`。

---

## 改动文件（共 2 个）

### 1. `internal/service/lark_webhook.go`

**改动 1：`LarkEvent` struct 加字段**（约第 52-65 行）

```go
type LarkEvent struct {
    // ... 现有字段 ...
    Referrer    string // 邀请人信息（形如 "uid=1024" 或 ""）
    ReferrerEoa string // 邀请人 EOA 地址（deposit_confirmed 用，无时为 ""）
    // ...
}
```

**改动 2：`buildCardContent` 的 `deposit_confirmed` case**（约第 395-404 行）

```go
case "deposit_confirmed":
    title = "🎉 认购到账：用户成功入金"
    template = "green"
    bodyMd = fmt.Sprintf(
        "**EOA**: %s\n**金额**: %s USDT\n**获得 ODD**: %s\n**轮次**: %s\n**邀请人**: %s\n**邀请人EOA**: %s\n**txHash**: %s",
        orDash(event.EOA), orDash(event.AmountUsdt),
        orDash(event.SharesOdd), orDash(event.RoundID),
        orDash(event.Referrer), orDash(event.ReferrerEoa),
        orDash(event.TxHash),
    )
```

### 2. `internal/service/presale_deposit_impl.go`

**改动：`NotifyDepositConfirmed`**（约第 738-756 行）

```go
func (s *presaleDepositService) NotifyDepositConfirmed(dep *model.PresaleDeposit) {
    if dep == nil {
        return
    }
    referrer := ""
    if dep.ReferrerUserID != nil {
        referrer = fmt.Sprintf("uid=%d", *dep.ReferrerUserID)
    }
    referrerEoa := ""
    if dep.ReferrerEoa != nil {
        referrerEoa = *dep.ReferrerEoa
    }
    s.larkAlerter.SendAnomalyAlert(LarkEvent{
        EventType:   "deposit_confirmed",
        TxHash:      dep.TxHash,
        EOA:         dep.EoaAddress,
        AmountUsdt:  dep.AmountUsdt.String(),
        RoundID:     dep.RoundID,
        SharesOdd:   dep.SharesOdd.String(),
        Referrer:    referrer,
        ReferrerEoa: referrerEoa,  // 新增
    })
}
```

---

## 测试要求

在 `internal/service/lark_webhook_test.go` 找到已有的带 `Referrer: "uid=1024"` 的测试 case，新增 `ReferrerEoa` 字段并断言 payload 包含该 EOA 字符串。

```go
svc.Notify(service.LarkEvent{
    EventType:   "deposit_confirmed",
    EOA:         "0xuser",
    AmountUsdt:  "100",
    SharesOdd:   "1000",
    RoundID:     "seed",
    Referrer:    "uid=1024",
    ReferrerEoa: "0xkol123",  // 新增
    TxHash:      "0xtx",
})
// assertPayloadField(t, req.body, "0xkol123")
```

同时新增一个无邀请人的 case，验证 `邀请人EOA` 行显示 `-`（`orDash("")`）。

---

## 不做什么

- 不改其他事件类型（overflow / unclaimed / paused_arrival 等）
- 不改任何 DB schema
- 不改 admin-backend 或前端
