package utils

import (
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash/crc32"
	"math/big"
	"strconv"
	"strings"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/params"
	"github.com/shopspring/decimal"
)

var MaxInt256 *big.Int

func init() {
	MaxInt256 = new(big.Int).Exp(big.NewInt(2), big.NewInt(255), nil)
	MaxInt256 = new(big.Int).Sub(MaxInt256, big.NewInt(1))
}

func Wei2Ether(balance *big.Int) *big.Int {
	return big.NewInt(0).Div(balance, big.NewInt(0).SetUint64(params.Ether))
}

func BigInt642Uint64(p *big.Int) uint64 {
	if p == nil {
		return 0
	}
	return p.Uint64()
}

func HexToBytes(hexStr string) ([]byte, error) {
	return hex.DecodeString(strings.TrimPrefix(hexStr, "0x"))
}

func BytesToHex(bs []byte) string {
	return "0x" + strings.ToLower(hex.EncodeToString(bs))
}

func Int256ToBigInt(b []byte) *big.Int {
	ret := new(big.Int).SetBytes(b)
	if ret.Cmp(MaxInt256) > 0 {
		ret = new(big.Int).Sub(ret, new(big.Int).Exp(big.NewInt(2), big.NewInt(256), nil))
	}
	return ret
}

func Uint256ToBigInt(b []byte) *big.Int {
	return new(big.Int).SetBytes(b)
}

func Uint64ToHex(blockNumber uint64) string {
	return "0x" + strings.ToLower(big.NewInt(int64(blockNumber)).Text(16))
}

func HexToUint64(hexStr string) (uint64, error) {
	ret, err := strconv.ParseUint(hexStr, 0, 64)
	if err != nil {
		return 0, err
	}
	return ret, nil
}

func CallWithRetry(call func() (bool, error), times int) error {
	var err error
	var stop bool
	for i := 0; i < times; i++ {
		stop, err = call()
		if err == nil {
			return nil
		} else if stop {
			return err
		}
	}
	return err
}

func HexToBigInt(hexStr string) (*big.Int, error) {
	ret, ok := new(big.Int).SetString(strings.TrimPrefix(hexStr, "0x"), 16)
	if !ok {
		return nil, fmt.Errorf("SetString failed %+v", hexStr)
	}
	return ret, nil
}

func HexToFloat64(hexStr string) float64 {
	if hexStr == "" {
		return 0
	}
	ret, err := HexToBigInt(hexStr)
	if err != nil {
		return 0
	}
	retFloat, _ := new(big.Float).SetInt(ret).Float64()
	return retFloat
}

func VerifySig(from, sigHex string, msg []byte) bool {
	fromAddr := common.HexToAddress(from)
	sig, err := hexutil.Decode(sigHex)
	if err != nil {
		return false
	}
	if len(sig) != crypto.SignatureLength {
		return false
	}
	if sig[crypto.RecoveryIDOffset] == 27 || sig[crypto.RecoveryIDOffset] == 28 {
		sig[crypto.RecoveryIDOffset] -= 27 // Transform yellow paper V from 27/28 to 0/1
	}

	pubKey, err := crypto.SigToPub(accounts.TextHash(msg), sig)
	if err != nil {
		return false
	}

	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	return fromAddr == recoveredAddr
}

func SignMessage(msg []byte, privateKey *ecdsa.PrivateKey) (string, error) {
	messageHash := accounts.TextHash(msg)
	signature, err := crypto.Sign(messageHash, privateKey)
	if err != nil {
		return "", err
	}
	return hexutil.Encode(signature), nil
}

func FormatAddress(address string) string {
	if strings.HasPrefix(address, "0x") {
		if _, err := HexToBytes(address); err == nil {
			return strings.ToLower(address)
		}
	}
	return address
}

func OrderTokens(token0Address, token1Address string) (string, string) {
	if token0Address < token1Address {
		return token0Address, token1Address
	}
	return token1Address, token0Address
}

func FormatHex(input string) string {
	if strings.HasPrefix(input, "0x") {
		return input
	}
	return "0x" + input
}

func BigIntAddRange(nums ...*big.Int) *big.Int {
	result := new(big.Int)
	for _, num := range nums {
		result.Add(result, num)
	}
	return result
}

func SHA256Hash(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// 若是0x则调用HexToUint64， 不是则：strconv.ParseUint(numStr, 10, 64)
func StrToUint64(numStr string) (uint64, error) {
	if numStr == "" {
		return 0, fmt.Errorf("numStr is empty")
	}
	if strings.HasPrefix(strings.ToLower(numStr), "0x") {
		return HexToUint64(numStr)
	}
	return strconv.ParseUint(numStr, 10, 64)
}

func GetChecksumByString(input string) uint32 {
	return crc32.ChecksumIEEE([]byte(input))
}

func HexToDecimal(balance string) (decimal.Decimal, bool) {
	balance = strings.TrimPrefix(balance, "0x")
	hexBigInt, ok := new(big.Int).SetString(balance, 16)
	if !ok {
		return decimal.Zero, false
	}
	return decimal.NewFromBigInt(hexBigInt, 0), true
}

func StrToDecimal(balance string) (decimal.Decimal, bool) {
	bigInt, ok := new(big.Int).SetString(balance, 10)
	if !ok {
		return decimal.Zero, false
	}
	return decimal.NewFromBigInt(bigInt, 0), true
}

const DefaultBatchSize = 1000

func SplitSlice[T any](params []T, batchSize ...int64) [][]T {
	bSize := DefaultBatchSize
	if len(batchSize) > 0 && batchSize[0] > 0 {
		bSize = int(batchSize[0])
	}
	total := len(params)
	if total == 0 {
		return nil
	}
	result := make([][]T, 0, (total+bSize-1)/bSize)
	for start := 0; start < total; {
		end := start + bSize
		if end > total {
			end = total
		}
		result = append(result, params[start:end])
		start = end
	}
	return result
}
