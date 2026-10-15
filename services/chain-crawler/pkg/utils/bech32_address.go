package utils

import (
	"encoding/hex"
	"strings"

	"github.com/btcsuite/btcd/btcutil/bech32"
)

const (
	IOTEX_ADDRESS_PRE  = "io"
	PLATON_ADDRESS_PRE = "lat"
)

// 将以太坊地址转换为Bech32地址
func EthereumToBech32(ethAddress string, hrp string) (string, error) {
	ethAddress = strings.TrimPrefix(ethAddress, "0x")
	data, err := hex.DecodeString(ethAddress)
	if err != nil {
		return "", err
	}
	// 将字节转换为5-bit的Bech32格式
	converted, err := bech32.ConvertBits(data, 8, 5, true)
	if err != nil {
		return "", err
	}
	// 编码为Bech32地址
	bech32Addr, err := bech32.Encode(hrp, converted)
	if err != nil {
		return "", err
	}
	return bech32Addr, nil
}

// 将Bech32地址转换为以太坊地址
func Bech32ToEthereum(bech32Addr string) (string, error) {
	_, data, err := bech32.Decode(bech32Addr)
	if err != nil {
		return "", err
	}
	// 将5-bit的Bech32格式转换为8-bit的字节
	converted, err := bech32.ConvertBits(data, 5, 8, false)
	if err != nil {
		return "", err
	}
	// 将字节编码为十六进制字符串
	ethAddress := hex.EncodeToString(converted)
	return "0x" + ethAddress, nil
}
