package utils

import (
	"crypto/md5"
	"encoding/hex"
)

func Md5Hex(input string) (string, error) {
	hash := md5.New()
	if _, err := hash.Write([]byte(input)); err != nil {
		return "", nil
	}

	output := hex.EncodeToString(hash.Sum(nil))
	hash.Reset()

	return output, nil
}
