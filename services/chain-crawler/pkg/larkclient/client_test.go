package larkclient

import (
	"context"
	"testing"
	"time"

	"chain_crawler/pkg/tracelog"

	"github.com/test-go/testify/assert"
)

func TestPostMessage(t *testing.T) {
	tracelog.InitLogger("dev")
	client := NewClient("dev")
	client.PostMessageAsync(context.Background(), "test", "test")
	time.Sleep(1 * time.Second)
}

func TestServiceNotify(t *testing.T) {
	tracelog.InitLogger("dev")
	client := NewClient("dev")
	err := client.NotifyServiceStart(context.Background(), "web3-test", "https://jenkins-web3.fulltrust.link/job/web3-token-tokenworker-test/changes")
	assert.Nil(t, err)
	client.NotifyServiceShutdown(context.Background(), "web3-test", "success")
	assert.Nil(t, err)
}

func TestPostMessageAsyncByServiceBotID(t *testing.T) {
	tracelog.InitLogger("dev")
	client := NewClient("dev")
	client.PostMessageAsyncByServiceBotID(context.Background(), "test", "test")
	time.Sleep(1 * time.Second)
}
