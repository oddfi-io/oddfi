package timelocker

import (
	"testing"
	"time"

	"github.com/test-go/testify/assert"
)

func TestTimeLockerCase1(t *testing.T) {
	locker := NewTimeLocker()

	ok := locker.TryLockTime("test", time.Second)
	assert.True(t, ok)

	ok = locker.TryLockTime("test", time.Second)
	assert.False(t, ok)

	time.Sleep(time.Second)

	ok = locker.TryLockTime("test", time.Second)
	assert.True(t, ok)
}

func TestTimeLockerCase2(t *testing.T) {
	locker := NewTimeLocker()

	ok := locker.TryLock("test")
	assert.True(t, ok)

	ok = locker.TryLock("test")
	assert.False(t, ok)

	locker.UnLock("test")

	ok = locker.TryLock("test")
	assert.True(t, ok)
}
