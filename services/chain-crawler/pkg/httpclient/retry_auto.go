package httpclient

import (
	"chain_crawler/pkg/utils"
	"errors"
	"fmt"
	"time"

	"github.com/avast/retry-go/v4"
)

type Retryable interface {
	//
	DoWithRetry(retryableFunc retry.RetryableFunc) error
}

type RetryableImpl struct {
}

// 提供一个默认的重试调用。
func (r RetryableImpl) DoWithRetry(retryFunc retry.RetryableFunc) error {
	if retryFunc == nil {
		return errors.New("RetryFunc cannot be nil")
	}
	var lastErr error
	err := retry.Do(retryFunc, retry.Delay(100*time.Millisecond), retry.Attempts(3), retry.RetryIf(func(err error) bool {
		lastErr = err
		return utils.IsTimeoutError(err) || IsTooManyRequestError(err)
	}))
	if err == nil {
		return nil
	}
	if httpError, ok := lastErr.(*ErrorDetail); ok {
		if httpError.Body == nil || len(httpError.Body) <= 0 {
			return lastErr
		}
		return fmt.Errorf("ErrorDetail: %s, body: %s", httpError.Error(), string(httpError.Body))
	}
	return lastErr
}
