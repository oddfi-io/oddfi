package utils

import (
	"net"
	"strings"
)

func IsTimeoutError(err error) bool {
	if urlErr, ok := err.(net.Error); ok {
		return urlErr.Timeout()
	}
	return strings.Contains(strings.ToLower(err.Error()), "timeout")
}
