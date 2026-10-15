package client

import (
	"testing"
	"time"

	"oddfi-web-spider/model"
)

func TestCalculateRequestIntervalKeepsTenPercentBuffer(t *testing.T) {
	got := calculateRequestInterval(&model.RateLimit{
		Remaining:       300,
		ResetsInSeconds: 360,
	})
	want := 1333 * time.Millisecond
	if got < want || got > want+time.Millisecond {
		t.Fatalf("interval = %v, want around %v", got, want)
	}
}

func TestCalculateRequestIntervalDoesNotSleepWholeWindowWhenQuotaIsLow(t *testing.T) {
	got := calculateRequestInterval(&model.RateLimit{
		Remaining:       17,
		ResetsInSeconds: 360,
	})
	want := 24 * time.Second
	if got != want {
		t.Fatalf("interval = %v, want %v", got, want)
	}
}
