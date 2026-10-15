package utils

import (
	"bytes"
	"encoding/hex"
	"fmt"

	"github.com/golang/snappy"
	jsoniter "github.com/json-iterator/go"
)

func JsonEncode(obj interface{}) (string, error) {
	buf := bytes.NewBuffer(nil)
	encoder := jsoniter.NewEncoder(buf)
	encoder.SetEscapeHTML(false) // html字符被转义
	if err := encoder.Encode(obj); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func JsonEncodeToBytes(obj interface{}) ([]byte, error) {
	config := jsoniter.Config{
		EscapeHTML:  false,
		SortMapKeys: false, // 不排序map键
		// ValidateJsonRawMessage: false, // 跳过RawMessage验证
	}.Froze()

	return config.Marshal(obj)
}

func JsonDecode(b []byte, obj interface{}) error {
	decoder := jsoniter.NewDecoder(bytes.NewBuffer(b))
	decoder.UseNumber() // 防止精度丢失
	return decoder.Decode(obj)
}

// 压缩JSON数据为Snappy格式
func CompressJsonWithSnappy(data interface{}) ([]byte, error) {
	if data == nil {
		return nil, fmt.Errorf("data cannot be nil")
	}

	jsonData, err := JsonEncodeToBytes(data)
	if err != nil {
		return nil, fmt.Errorf("json encode failed: %w", err)
	}

	compressedData := snappy.Encode(nil, jsonData)
	return compressedData, nil
}

// 从Snappy格式解压缩JSON数据
func DecompressJsonWithSnappy(compressedData []byte, result interface{}) error {
	if len(compressedData) == 0 {
		return fmt.Errorf("compressed data is empty")
	}
	if result == nil {
		return fmt.Errorf("result cannot be nil")
	}

	decompressedData, err := snappy.Decode(nil, compressedData)
	if err != nil {
		return fmt.Errorf("snappy decode failed: %w", err)
	}

	if err := JsonDecode(decompressedData, result); err != nil {
		return fmt.Errorf("json decode failed: %w", err)
	}

	return nil
}

// 压缩JSON并编码为十六进制字符串（用于存储/传输）
func CompressJsonToHexString(data interface{}) (string, error) {
	compressed, err := CompressJsonWithSnappy(data)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(compressed), nil
}

// 从十六进制字符串解压缩JSON数据
func DecompressJsonFromHexString(hexString string, result interface{}) error {
	if hexString == "" {
		return fmt.Errorf("hex string is empty")
	}

	compressedData, err := hex.DecodeString(hexString)
	if err != nil {
		return fmt.Errorf("hex decode failed: %w", err)
	}

	return DecompressJsonWithSnappy(compressedData, result)
}
