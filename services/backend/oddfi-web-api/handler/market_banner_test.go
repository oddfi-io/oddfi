package handler

import "testing"

func TestBuildLocalizedMarketBannersZhTranslatesPlayerNames(t *testing.T) {
	banners := buildLocalizedMarketBanners("zh")

	tests := []struct {
		templateID string
		playerID   string
		wantName   string
	}{
		{templateID: "top_golden_ball_name", playerID: "p_bellingham", wantName: "裘德·贝林厄姆"},
		{templateID: "top_golden_ball_name", playerID: "p_yamal", wantName: "拉明·亚马尔"},
		{templateID: "top_golden_boot_name", playerID: "p_haaland", wantName: "埃尔林·哈兰德"},
		{templateID: "top_golden_glove_name", playerID: "p_courtois", wantName: "蒂博·库尔图瓦"},
	}

	for _, tt := range tests {
		gotName, ok := findBannerPlayerName(banners, tt.templateID, tt.playerID)
		if !ok {
			t.Fatalf("missing player %s in template %s", tt.playerID, tt.templateID)
		}
		if gotName != tt.wantName {
			t.Fatalf("player %s name = %q, want %q", tt.playerID, gotName, tt.wantName)
		}
	}
}

func findBannerPlayerName(banners []marketBanner, templateID, playerID string) (string, bool) {
	for _, banner := range banners {
		if banner.TemplateID != templateID {
			continue
		}
		for _, item := range banner.Items {
			if item.PlayerID == playerID {
				return item.Name, true
			}
		}
		return "", false
	}
	return "", false
}
