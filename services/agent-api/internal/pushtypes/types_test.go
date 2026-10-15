package pushtypes

import (
	"testing"
	"time"
)

func TestBuildBaseCard_NewFields(t *testing.T) {
	cases := []struct {
		name        string
		createdAtMs int64
		wantCreated bool
	}{
		{"explicit timestamp", 1700000000000, true},
		{"zero falls back to now", 0, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			before := time.Now().UnixMilli()
			c := BuildBaseCard("id1", "@h", "@a", "Name", "text", tc.createdAtMs)
			after := time.Now().UnixMilli()

			if c.ID != "id1" {
				t.Errorf("ID got %q", c.ID)
			}
			if c.EnrichStatus != "pending" {
				t.Errorf("EnrichStatus got %q want pending", c.EnrichStatus)
			}
			if c.IngestedAt < before || c.IngestedAt > after {
				t.Errorf("IngestedAt=%d outside [%d, %d]", c.IngestedAt, before, after)
			}
			if (c.CreatedAt > 0) != tc.wantCreated {
				t.Errorf("CreatedAt=%d wantNonZero=%v", c.CreatedAt, tc.wantCreated)
			}
			// 兼容期：Time 仍需有值；AiEnriched=false
			if c.Time == "" {
				t.Errorf("Time empty (deprecated 字段兼容期必须有)")
			}
			if c.AiEnriched {
				t.Errorf("AiEnriched should be false on base card")
			}
		})
	}
}

func TestBuildBaseCard_AuthorFallback(t *testing.T) {
	c := BuildBaseCard("id1", "@src", "", "", "txt", 0)
	if c.Source != "🐦 @src" {
		t.Errorf("Source got %q want 🐦 @src (authorHandle 空时 fallback sourceHandle)", c.Source)
	}
}

func TestApplyEnrichment_OK(t *testing.T) {
	c := BuildBaseCard("id", "@s", "@a", "", "txt", 0)
	ai := &AiAnalysis{Change: "up", PriceImpact: "<b class=\"delta-up\">↑</b>", ProbImpact: "+5%"}
	sug := &Suggest{Text: "买", Action: "act", Alt: ""}
	ApplyEnrichment(c, "odds", "赔率剧变", "标题", "Real vs Barca", ai, sug)

	if c.EnrichStatus != "ok" {
		t.Errorf("EnrichStatus=%q want ok", c.EnrichStatus)
	}
	if !c.AiEnriched {
		t.Errorf("兼容期 AiEnriched 必须为 true")
	}
	if c.Tag != "odds" || c.TagLabel != "赔率剧变" || c.Title != "标题" || c.Match != "Real vs Barca" {
		t.Errorf("增强字段未写入：%+v", c)
	}
	if c.AiAnalysis == nil || c.AiAnalysis.PriceImpact == "" {
		t.Errorf("AiAnalysis 未写入")
	}
	if c.Suggest == nil || c.Suggest.Text == "" {
		t.Errorf("Suggest 未写入")
	}
}

func TestApplyEnrichment_EmptyFieldsKeepOld(t *testing.T) {
	c := &PushCard{ID: "x", Tag: "match", Title: "旧标题"}
	ApplyEnrichment(c, "", "", "", "", nil, nil)
	if c.Tag != "match" || c.Title != "旧标题" {
		t.Errorf("空字段不应覆盖旧值")
	}
	if c.EnrichStatus != "ok" {
		t.Errorf("EnrichStatus=%q want ok", c.EnrichStatus)
	}
}

func TestMarkEnrichSkipped(t *testing.T) {
	c := BuildBaseCard("id", "@s", "@a", "", "txt", 0)
	MarkEnrichSkipped(c)
	if c.EnrichStatus != "skipped" {
		t.Errorf("EnrichStatus=%q want skipped", c.EnrichStatus)
	}
	if c.AiEnriched {
		t.Errorf("skipped 时 AiEnriched 不应为 true")
	}
}

func TestMarkEnrichFailed(t *testing.T) {
	c := BuildBaseCard("id", "@s", "@a", "", "txt", 0)
	MarkEnrichFailed(c)
	if c.EnrichStatus != "failed" {
		t.Errorf("EnrichStatus=%q want failed", c.EnrichStatus)
	}
	if c.AiEnriched {
		t.Errorf("failed 时 AiEnriched 不应为 true")
	}
}

func TestFormatRelativeTime(t *testing.T) {
	now := time.Now().UnixMilli()
	cases := []struct {
		name    string
		unixMs  int64
		want    string
	}{
		{"刚刚", now - 30*1000, "刚刚"},
		{"5 分钟前", now - 5*60*1000, "5 分钟前"},
		{"2 小时前", now - 2*3600*1000, "2 小时前"},
		{"3 天前", now - 3*24*3600*1000, "3 天前"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := FormatRelativeTime(tc.unixMs)
			if got != tc.want {
				t.Errorf("got %q want %q", got, tc.want)
			}
		})
	}
}
