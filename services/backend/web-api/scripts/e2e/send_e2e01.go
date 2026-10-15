//go:build ignore

// E2E-01：正常入账 — 从测试 EOA 发 1 USDT (BEP20) 到金库地址
// 跑完后打印 txHash，让你/Worker 监听该 tx 入账落库
package main

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/shopspring/decimal"
)

const (
	usdtAddress  = "0x55d398326f99059fF775485246999027B3197955" // BSC mainnet USDT (BEP20，18 decimals)
	vaultAddress = "0xf4b6036d2423B1254f273272929364A120a50c7C" // 测试金库
	bscChainID   = 56
)

func main() {
	rpcURL := os.Getenv("PRESALE_BSC_RPC_URL")
	if rpcURL == "" {
		fmt.Fprintln(os.Stderr, "PRESALE_BSC_RPC_URL env required")
		os.Exit(1)
	}
	privHex := os.Getenv("TEST_PRESALE_EOA_PRIV_KEY")
	if privHex == "" {
		fmt.Fprintln(os.Stderr, "TEST_PRESALE_EOA_PRIV_KEY env required (64 hex without 0x)")
		os.Exit(1)
	}
	amountUsdtStr := os.Getenv("AMOUNT_USDT")
	if amountUsdtStr == "" {
		amountUsdtStr = "1"
	}
	// BEP20 USDT 是 18 decimals；用 decimal 支持小数解析
	amountDec, err := decimal.NewFromString(amountUsdtStr)
	if err != nil {
		panic(fmt.Sprintf("invalid AMOUNT_USDT %q: %v", amountUsdtStr, err))
	}
	amountWei := amountDec.Mul(decimal.New(1, 18)).BigInt()

	ec, err := ethclient.Dial(rpcURL)
	if err != nil {
		panic(err)
	}
	defer ec.Close()

	privKey, err := crypto.HexToECDSA(strings.TrimPrefix(privHex, "0x"))
	if err != nil {
		panic(err)
	}
	pubKey := privKey.Public().(*ecdsa.PublicKey)
	fromAddr := crypto.PubkeyToAddress(*pubKey)
	fmt.Printf("From: %s\n", fromAddr.Hex())
	fmt.Printf("To (vault): %s\n", vaultAddress)
	fmt.Printf("USDT amount: %s (%s wei)\n", amountUsdtStr, amountWei.String())

	// 构造 USDT.transfer(vault, amount) calldata
	transferSelector := []byte{0xa9, 0x05, 0x9c, 0xbb}
	paddedTo := common.LeftPadBytes(common.HexToAddress(vaultAddress).Bytes(), 32)
	paddedAmount := common.LeftPadBytes(amountWei.Bytes(), 32)
	data := append(transferSelector, paddedTo...)
	data = append(data, paddedAmount...)

	ctx := context.Background()
	nonce, err := ec.PendingNonceAt(ctx, fromAddr)
	if err != nil {
		panic(err)
	}
	gasPrice, err := ec.SuggestGasPrice(ctx)
	if err != nil {
		panic(err)
	}
	usdtAddr := common.HexToAddress(usdtAddress)
	msg := types.NewTx(&types.LegacyTx{
		Nonce:    nonce,
		To:       &usdtAddr,
		Value:    big.NewInt(0),
		Gas:      80000,
		GasPrice: gasPrice,
		Data:     data,
	})

	signer := types.NewEIP155Signer(big.NewInt(bscChainID))
	signedTx, err := types.SignTx(msg, signer, privKey)
	if err != nil {
		panic(err)
	}

	fmt.Printf("\nSending tx... nonce=%d gasPrice=%s\n", nonce, gasPrice.String())
	if err := ec.SendTransaction(ctx, signedTx); err != nil {
		panic(err)
	}
	fmt.Printf("✅ txHash: %s\n", signedTx.Hash().Hex())
	fmt.Printf("Track at: https://bscscan.com/tx/%s\n", signedTx.Hash().Hex())
}

func parseDecimal(s string) *big.Int {
	v, _ := new(big.Int).SetString(s, 10)
	return v
}
