package utils

import (
	"testing"
	"time"
)

func TestMoneylineCadenceByLifecycle(t *testing.T) {
	startAt := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name    string
		now     time.Time
		stateID int
		want    time.Duration
	}{
		{name: "far pre match", now: startAt.AddDate(0, 0, -10), stateID: 1, want: 30 * time.Minute},
		{name: "near pre match", now: startAt.Add(-12 * time.Hour), stateID: 1, want: 10 * time.Minute},
		{name: "last hour", now: startAt.Add(-30 * time.Minute), stateID: 1, want: 2 * time.Minute},
		{name: "live", now: startAt.Add(15 * time.Minute), stateID: 22, want: time.Minute},
		{name: "anomaly", now: startAt.Add(15 * time.Minute), stateID: 18, want: 30 * time.Minute},
	}

	for _, tt := range tests {
		got, ok := MoneylineCadence(tt.now, startAt, tt.stateID)
		if !ok {
			t.Fatalf("%s: ok=false, want true", tt.name)
		}
		if got != tt.want {
			t.Fatalf("%s: cadence=%v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestMoneylineWindowUsesFourteenDaysAndThreeHourBuffer(t *testing.T) {
	startAt := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	if IsWithinMoneylineWindow(startAt.AddDate(0, 0, -14).Add(-time.Nanosecond), startAt) {
		t.Fatal("before 14d window should be false")
	}
	if !IsWithinMoneylineWindow(startAt.AddDate(0, 0, -14), startAt) {
		t.Fatal("14d boundary should be true")
	}
	if !IsWithinMoneylineWindow(startAt.Add(3*time.Hour-time.Nanosecond), startAt) {
		t.Fatal("inside +3h buffer should be true")
	}
	if IsWithinMoneylineWindow(startAt.Add(3*time.Hour), startAt) {
		t.Fatal("+3h boundary should be false")
	}
}
