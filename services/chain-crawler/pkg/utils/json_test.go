package utils

import (
	"encoding/hex"
	"encoding/json"
	"testing"

	"github.com/test-go/testify/assert"
)

type BlockInternalTrace struct {
	Result []InternalTrace `json:"result"`
}

type InternalTrace struct {
	Action struct {
		From     string `json:"from"`
		CallType string `json:"callType,omitempty"`
		Gas      string `json:"gas"`
		Input    string `json:"input,omitempty"`
		To       string `json:"to,omitempty"`
		Value    string `json:"value"`
	} `json:"action"`
	BlockHash   string `json:"blockHash"`
	BlockNumber int    `json:"blockNumber"`
	Error       string `json:"error,omitempty"`
	Result      struct {
		Address string `json:"value,omitempty"`
		Code    string `json:"code,omitempty"`
		GasUsed string `json:"gasUsed"`
		Output  string `json:"output,omitempty"`
	} `json:"result"`
	Subtraces           int    `json:"subtraces"`
	TraceAddress        []int  `json:"traceAddress"`
	TransactionHash     string `json:"transactionHash"`
	TransactionPosition int    `json:"transactionPosition"`
	Type                string `json:"type"`
}

// GetCompressionRatio 计算压缩率
func GetCompressionRatio(originalSize, compressedSize int) float64 {
	if originalSize == 0 {
		return 0
	}
	return 100.0 - (float64(compressedSize) / float64(originalSize) * 100)
}

func TestCompressJSONWithSnappy(t *testing.T) {
	data := `{
		"result": [
			{
				"action": {
					"from": "0x8aca9f67c43fd81cf10e553bd1268649762f67d0",
					"callType": "call",
					"gas": "0x5efe9",
					"input": "0x3a571299000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001200000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000002a7a94e5292bb5e34490000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000069e9e7d04c61103efc19540603ea7e6264ec5231000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
					"to": "0x3a10dc1a145da500d5fba38b9ec49c8ff11a981f",
					"value": "0x0"
				},
				"blockHash": "0x079660656325e1c304a332bfdfbcae0c4d27289af7639f823c5d83feab99bce6",
				"blockNumber": 22634658,
				"result": {
					"gasUsed": "0x465c1",
					"output": "0x00000000000000000000000000000000000000000000000000e807aa33e15fb2"
				},
				"subtraces": 1,
				"traceAddress": [],
				"transactionHash": "0xc4809e16ce4fc0eff59f5ac261c6b878970b683d88e04a7b3eb72236aa046fed",
				"transactionPosition": 0,
				"type": "call"
			},
			{
				"action": {
					"from": "0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97",
					"callType": "call",
					"gas": "0x457",
					"input": "0x",
					"to": "0x388c818ca8b9251b393131c08a736a67ccb19297",
					"value": "0x5eb465036614f9"
				},
				"blockHash": "0x079660656325e1c304a332bfdfbcae0c4d27289af7639f823c5d83feab99bce6",
				"blockNumber": 22634658,
				"result": {
					"gasUsed": "0x457",
					"output": "0x"
				},
				"subtraces": 0,
				"traceAddress": [],
				"transactionHash": "0xbce39014cda66fbda7621692d12387d95d5915708e31dec5e0b00f5874979238",
				"transactionPosition": 162,
				"type": "call"
			}
		]
	}`

	originalData := BlockInternalTrace{}
	err := json.Unmarshal([]byte(data), &originalData)
	assert.NoError(t, err)
	t.Logf("原始数据: %+v", originalData)

	compressed, err := CompressJsonWithSnappy(originalData)
	assert.NoError(t, err)

	decompressedData := BlockInternalTrace{}
	err = DecompressJsonWithSnappy(compressed, &decompressedData)
	assert.NoError(t, err)

	t.Logf("原始数据大小: %d 字节", len(data))
	t.Logf("压缩后大小: %d 字节", len(compressed))
	t.Logf("压缩率: %.2f%%", 100.0-(float64(len(compressed))/float64(len(data))*100))
	t.Logf("解压缩结果: %+v", decompressedData)

	assert.Equal(t, originalData, decompressedData)
}

// 测试十六进制编码/解码场景（模拟存储/传输）
func TestCompressJSONWithSnappyHexEncoding(t *testing.T) {
	data := `{
		"result": [
			{
				"action": {
					"from": "0x8aca9f67c43fd81cf10e553bd1268649762f67d0",
					"callType": "call",
					"gas": "0x5efe9",
					"input": "0x3a571299000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001200000000000000000000000007a250d5630b4cf539739df2c5dacb4c659f2488d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000002a7a94e5292bb5e34490000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000069e9e7d04c61103efc19540603ea7e6264ec5231000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
					"to": "0x3a10dc1a145da500d5fba38b9ec49c8ff11a981f",
					"value": "0x0"
				},
				"blockHash": "0x079660656325e1c304a332bfdfbcae0c4d27289af7639f823c5d83feab99bce6",
				"blockNumber": 22634658,
				"result": {
					"gasUsed": "0x465c1",
					"output": "0x00000000000000000000000000000000000000000000000000e807aa33e15fb2"
				},
				"subtraces": 1,
				"traceAddress": [],
				"transactionHash": "0xc4809e16ce4fc0eff59f5ac261c6b878970b683d88e04a7b3eb72236aa046fed",
				"transactionPosition": 0,
				"type": "call"
			},
			{
				"action": {
					"from": "0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97",
					"callType": "call",
					"gas": "0x457",
					"input": "0x",
					"to": "0x388c818ca8b9251b393131c08a736a67ccb19297",
					"value": "0x5eb465036614f9"
				},
				"blockHash": "0x079660656325e1c304a332bfdfbcae0c4d27289af7639f823c5d83feab99bce6",
				"blockNumber": 22634658,
				"result": {
					"gasUsed": "0x457",
					"output": "0x"
				},
				"subtraces": 0,
				"traceAddress": [],
				"transactionHash": "0xbce39014cda66fbda7621692d12387d95d5915708e31dec5e0b00f5874979238",
				"transactionPosition": 162,
				"type": "call"
			}
		]
	}`

	testData := BlockInternalTrace{}
	err := json.Unmarshal([]byte(data), &testData)
	assert.NoError(t, err)
	t.Logf("原始数据: %+v", testData)

	compressed, err := CompressJsonWithSnappy(testData)
	assert.NoError(t, err)

	hexString := hex.EncodeToString(compressed)
	t.Logf("十六进制编码: %s", hexString)

	decodedBytes, err := hex.DecodeString(hexString)
	assert.NoError(t, err)

	// 解压缩
	var result BlockInternalTrace
	err = DecompressJsonWithSnappy(decodedBytes, &result)
	assert.NoError(t, err)

	t.Logf("解压缩结果: %+v", result)
}

func TestCompressJsonToHexString(t *testing.T) {
	testData := struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
		Success bool   `json:"success"`
	}{
		Message: "Hello World",
		Code:    200,
		Success: true,
	}

	hexString, err := CompressJsonToHexString(testData)
	assert.NoError(t, err)
	t.Logf("压缩后的十六进制字符串: %s", hexString)

	// 从十六进制字符串解压缩
	var result struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
		Success bool   `json:"success"`
	}
	err = DecompressJsonFromHexString(hexString, &result)
	assert.NoError(t, err)

	t.Logf("解压缩结果: %+v", result)
	assert.Equal(t, testData.Message, result.Message)
	assert.Equal(t, testData.Success, result.Success)

	// 测试压缩效果
	originalJson, _ := JsonEncodeToBytes(testData)
	compressedBytes, _ := hex.DecodeString(hexString)
	ratio := GetCompressionRatio(len(originalJson), len(compressedBytes))
	t.Logf("原始大小: %d, 压缩大小: %d, 压缩率: %.2f%%",
		len(originalJson), len(compressedBytes), ratio)
}
