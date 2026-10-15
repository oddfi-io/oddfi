package handler

import (
	"log"
	"net/http"
	"oddfi-web-api/model"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type marketBannerResponse struct {
	Code int            `json:"code"`
	Data []marketBanner `json:"data"`
}

type marketBanner struct {
	BannerID      string             `json:"banner_id"`
	TemplateID    string             `json:"template_id"`
	SortOrder     int                `json:"sort_order"`
	IsActive      bool               `json:"is_active"`
	TagText       string             `json:"tag_text"`
	TagColor      string             `json:"tag_color"`
	Title         string             `json:"title"`
	Subtitle      *string            `json:"subtitle"`
	DecorationKey string             `json:"decoration_key"`
	EndTime       string             `json:"end_time"`
	Items         []marketBannerItem `json:"items"`
}

type marketBannerItem struct {
	Name               string                 `json:"name"`
	CountryCode        string                 `json:"country_code,omitempty"`
	PlayerID           string                 `json:"player_id,omitempty"`
	Odds               float64                `json:"odds"`
	ImpliedProbability float64                `json:"implied_probability"`
	MarketID           int64                  `json:"market_id"`
	SelectionID        int64                  `json:"selection_id"`
	BetMode            []string               `json:"bet_mode"`
	Extra              map[string]interface{} `json:"extra"`
	ImageURL           string                 `json:"image_url"`
}

var supportedBannerLangs = map[string]struct{}{
	"pt": {},
	"ja": {},
	"es": {},
	"tr": {},
	"de": {},
	"fr": {},
	"hi": {},
	"en": {},
	"zh": {},
}

// 国家国旗链接
// 西班牙 Spain → https://cdn.sportmonks.com/images/countries/png/short/es.png
// 法国 France → https://cdn.sportmonks.com/images/countries/png/short/fr.png
// 英格兰 England → https://flagcdn.com/w320/gb-eng.png
// 阿根廷 Argentina → https://cdn.sportmonks.com/images/countries/png/short/ar.png
// 巴西 Brazil → https://cdn.sportmonks.com/images/countries/png/short/br.png
// 德国 Germany → https://cdn.sportmonks.com/images/countries/png/short/de.png
// 葡萄牙 Portugal → https://cdn.sportmonks.com/images/countries/png/short/pt.png
// 荷兰 Netherlands → https://cdn.sportmonks.com/images/countries/png/short/nl.png
// 意大利 Italy → https://cdn.sportmonks.com/images/countries/png/short/it.png
// 挪威 Norway → https://cdn.sportmonks.com/images/countries/png/short/no.png

var marketBannerBaseData = []marketBanner{
	{
		BannerID:      "bnr_001",
		TemplateID:    "top_wins_the_world_cup",
		SortOrder:     1,
		IsActive:      true,
		TagText:       "HOT MARKET",
		TagColor:      "#FF8A00",
		Title:         "Who Wins The World Cup ?",
		DecorationKey: "world_cup_trophy",
		EndTime:       "2026-07-22 23:59:59",
		Items: []marketBannerItem{
			{Name: "SPAIN", ImageURL: "https://cdn.sportmonks.com/images/countries/png/short/es.png", CountryCode: "ES", Odds: 5.00, ImpliedProbability: 20.0, MarketID: 1001, SelectionID: 10001, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 5, "tvl": 850000}},
			{Name: "FRANCE", ImageURL: "https://cdn.sportmonks.com/images/countries/png/short/fr.png", CountryCode: "FR", Odds: 5.50, ImpliedProbability: 18.2, MarketID: 1002, SelectionID: 10002, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 0, "tvl": 720000}},
			{Name: "ENGLAND", ImageURL: "https://flagcdn.com/w320/gb-eng.png", CountryCode: "GB-ENG", Odds: 6.00, ImpliedProbability: 16.7, MarketID: 1003, SelectionID: 10003, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 0, "tvl": 680000}},
			{Name: "ARGENTINA", ImageURL: "https://cdn.sportmonks.com/images/countries/png/short/ar.png", CountryCode: "AR", Odds: 6.50, ImpliedProbability: 15.4, MarketID: 1004, SelectionID: 10004, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 0, "tvl": 640000}},
			{Name: "BRAZIL", ImageURL: "https://cdn.sportmonks.com/images/countries/png/short/br.png", CountryCode: "BR", Odds: 7.00, ImpliedProbability: 14.3, MarketID: 1005, SelectionID: 10005, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 0, "tvl": 580000}},
			{Name: "GERMANY", ImageURL: "https://cdn.sportmonks.com/images/countries/png/short/de.png", CountryCode: "DE", Odds: 11.00, ImpliedProbability: 9.1, MarketID: 1006, SelectionID: 10006, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 0, "tvl": 320000}},
			{Name: "PORTUGAL", ImageURL: "https://cdn.sportmonks.com/images/countries/png/short/pt.png", CountryCode: "PT", Odds: 13.00, ImpliedProbability: 7.7, MarketID: 1007, SelectionID: 10007, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 0, "tvl": 260000}},
			{Name: "NETHERLANDS", ImageURL: "https://cdn.sportmonks.com/images/countries/png/short/nl.png", CountryCode: "NL", Odds: 17.00, ImpliedProbability: 5.9, MarketID: 1008, SelectionID: 10008, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 0, "tvl": 180000}},
			{Name: "ITALY", ImageURL: "https://cdn.sportmonks.com/images/countries/png/short/it.png", CountryCode: "IT", Odds: 21.00, ImpliedProbability: 4.8, MarketID: 1009, SelectionID: 10009, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 0, "tvl": 120000}},
			{Name: "NORWAY", ImageURL: "https://cdn.sportmonks.com/images/countries/png/short/no.png", CountryCode: "NO", Odds: 26.00, ImpliedProbability: 3.8, MarketID: 1010, SelectionID: 10010, BetMode: []string{"single"}, Extra: map[string]interface{}{"heat": 0, "tvl": 90000}},
		},
	},
	{
		BannerID:      "bnr_002",
		TemplateID:    "total_goals",
		SortOrder:     2,
		IsActive:      true,
		TagText:       "PLAYER SPECIAL",
		TagColor:      "#22C55E",
		Title:         "RONALDO TOTAL GOALS",
		Subtitle:      stringPtr("CRISTIANO RONALDO · FWD · #7"),
		DecorationKey: "player_ronaldo",
		EndTime:       "2026-07-22 23:59:59",
		Items: []marketBannerItem{
			{Name: "1 goal", Odds: 3.80, ImpliedProbability: 24.0, MarketID: 2001, SelectionID: 20001, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 1, "is_favorite": true, "tvl": 420000}},
			{Name: "2 goals", Odds: 4.00, ImpliedProbability: 22.0, MarketID: 2002, SelectionID: 20002, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 2, "is_favorite": false, "tvl": 380000}},
			{Name: "0 goal", Odds: 6.00, ImpliedProbability: 15.0, MarketID: 2003, SelectionID: 20003, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 0, "is_favorite": false, "tvl": 180000}},
			{Name: "3 goals", Odds: 6.50, ImpliedProbability: 14.0, MarketID: 2004, SelectionID: 20004, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 3, "is_favorite": false, "tvl": 160000}},
			{Name: "4 goals", Odds: 10.00, ImpliedProbability: 9.0, MarketID: 2005, SelectionID: 20005, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 4, "is_favorite": false, "tvl": 110000}},
			{Name: "5 goals", Odds: 15.00, ImpliedProbability: 6.0, MarketID: 2006, SelectionID: 20006, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 5, "is_favorite": false, "tvl": 65000}},
			{Name: "6 goals", Odds: 22.00, ImpliedProbability: 4.0, MarketID: 2007, SelectionID: 20007, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 6, "is_favorite": false, "tvl": 35000}},
			{Name: "7 goals", Odds: 30.00, ImpliedProbability: 3.0, MarketID: 2008, SelectionID: 20008, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 7, "is_favorite": false, "tvl": 20000}},
			{Name: "8 goals", Odds: 45.00, ImpliedProbability: 2.0, MarketID: 2009, SelectionID: 20009, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 8, "is_favorite": false, "tvl": 12000}},
			{Name: "8+ goals", Odds: 90.00, ImpliedProbability: 1.0, MarketID: 2010, SelectionID: 20010, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals_slot": 9, "is_favorite": false, "tvl": 5000}},
		},
	},
	{
		BannerID:      "bnr_003",
		TemplateID:    "top_golden_ball_name",
		SortOrder:     3,
		IsActive:      true,
		TagText:       "GOLDEN BALL",
		TagColor:      "#06B6D4",
		Title:         "Who Will Be The MVP ?",
		DecorationKey: "player_bellingham",
		EndTime:       "2026-07-22 23:59:59",
		Items: []marketBannerItem{
			//球星的URL
			// | 裘德·贝林厄姆     | Jude Bellingham   | `https://r2.thesportsdb.com/images/media/player/thumb/rfg8xd1771263826.jpg/medium`
			// | 基利安·姆巴佩     | Kylian Mbappé     | `https://r2.thesportsdb.com/images/media/player/thumb/0yw04y1771265385.jpg/medium`
			// | 拉明·亚马尔      | Lamine Yamal      | https://upload.wikimedia.org/wikipedia/commons/2/2c/Lamine_Yamal_in_2025_%28cropped%29.jpg
			// | 维尼修斯·儒尼奥尔   | Vinicius Jr       | `https://r2.thesportsdb.com/images/media/player/thumb/lxf1he1771264845.jpg/medium`
			// | 利昂内尔·梅西     | Lionel Messi      | `https://r2.thesportsdb.com/images/media/player/thumb/kpfsvp1725295651.jpg/medium`
			// | 罗德里         | Rodri             | https://upload.wikimedia.org/wikipedia/commons/4/41/RODRI_-_SWE_vs_ESP_-_UEFA_EURO_2020_QUALIFIERS_-_2019.10.15_%28cropped%29.jpg
			// | 弗洛里安·维尔茨    | Florian Wirtz     | `https://r2.thesportsdb.com/images/media/player/thumb/m1o8hn1752010521.jpg/medium`
			// | 佩德里         | Pedri             | `https://r2.thesportsdb.com/images/media/player/thumb/ejirdp1771259784.jpg/medium`
			// | 菲尔·福登       | Phil Foden        | `https://r2.thesportsdb.com/images/media/player/thumb/19o7yc1749157221.jpg/medium`
			// | 克里斯蒂亚诺·罗纳尔多 | Cristiano Ronaldo | `https://r2.thesportsdb.com/images/media/player/thumb/bkre241600892282.jpg/medium`

			{Name: "JUDE BELLINGHAM", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/rfg8xd1771263826.jpg/medium", CountryCode: "GB-ENG", PlayerID: "p_bellingham", Odds: 5.50, ImpliedProbability: 18.2, MarketID: 3001, SelectionID: 30001, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 520000}},
			{Name: "KYLIAN MBAPPÉ", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/0yw04y1771265385.jpg/medium", CountryCode: "FR", PlayerID: "p_mbappe", Odds: 6.00, ImpliedProbability: 16.7, MarketID: 3002, SelectionID: 30002, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 480000}},
			{Name: "LAMINE YAMAL", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Lamine_Yamal_in_2025_%28cropped%29.jpg", CountryCode: "ES", PlayerID: "p_yamal", Odds: 7.00, ImpliedProbability: 14.3, MarketID: 3003, SelectionID: 30003, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 390000}},
			{Name: "VINICIUS JR", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/lxf1he1771264845.jpg/medium", CountryCode: "BR", PlayerID: "p_vinicius", Odds: 8.00, ImpliedProbability: 12.5, MarketID: 3004, SelectionID: 30004, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 350000}},
			{Name: "LIONEL MESSI", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/kpfsvp1725295651.jpg/medium", CountryCode: "AR", PlayerID: "p_messi", Odds: 11.00, ImpliedProbability: 9.1, MarketID: 3005, SelectionID: 30005, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 620000}},
			{Name: "RODRI", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/4/41/RODRI_-_SWE_vs_ESP_-_UEFA_EURO_2020_QUALIFIERS_-_2019.10.15_%28cropped%29.jpg", CountryCode: "ES", PlayerID: "p_rodri", Odds: 13.00, ImpliedProbability: 7.7, MarketID: 3006, SelectionID: 30006, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 180000}},
			{Name: "FLORIAN WIRTZ", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/m1o8hn1752010521.jpg/medium", CountryCode: "DE", PlayerID: "p_wirtz", Odds: 15.00, ImpliedProbability: 6.7, MarketID: 3007, SelectionID: 30007, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 150000}},
			{Name: "PEDRI", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/ejirdp1771259784.jpg/medium", CountryCode: "ES", PlayerID: "p_pedri", Odds: 17.00, ImpliedProbability: 5.9, MarketID: 3008, SelectionID: 30008, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 120000}},
			{Name: "PHIL FODEN", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/19o7yc1749157221.jpg/medium", CountryCode: "GB-ENG", PlayerID: "p_foden", Odds: 19.00, ImpliedProbability: 5.3, MarketID: 3009, SelectionID: 30009, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 100000}},
			{Name: "CRISTIANO RONALDO", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/bkre241600892282.jpg/medium", CountryCode: "PT", PlayerID: "p_ronaldo", Odds: 21.00, ImpliedProbability: 4.8, MarketID: 3010, SelectionID: 30010, BetMode: []string{"single"}, Extra: map[string]interface{}{"tvl": 580000}},
		},
	},
	{
		BannerID:      "bnr_004",
		TemplateID:    "top_golden_boot_name",
		SortOrder:     4,
		IsActive:      true,
		TagText:       "GOLDEN BOOT",
		TagColor:      "#EF4444",
		Title:         "TOP SCORER OF THE TOURNAMENT",
		DecorationKey: "golden_boot",
		EndTime:       "2026-07-22 23:59:59",
		Items: []marketBannerItem{
			{Name: "KYLIAN MBAPPÉ", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/0yw04y1771265385.jpg/medium", CountryCode: "FR", PlayerID: "p_mbappe", Odds: 4.50, ImpliedProbability: 22.2, MarketID: 4001, SelectionID: 40001, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 4, "tvl": 680000}},
			{Name: "ERLING HAALAND", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/bb1agj1727415216.jpg/medium", CountryCode: "NO", PlayerID: "p_haaland", Odds: 5.50, ImpliedProbability: 18.2, MarketID: 4002, SelectionID: 40002, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 3, "tvl": 520000}},
			{Name: "HARRY KANE", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/0w9up71770542636.jpg/medium", CountryCode: "GB-ENG", PlayerID: "p_kane", Odds: 6.50, ImpliedProbability: 15.4, MarketID: 4003, SelectionID: 40003, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 3, "tvl": 410000}},
			{Name: "VINICIUS JR", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/lxf1he1771264845.jpg/medium", CountryCode: "BR", PlayerID: "p_vinicius", Odds: 8.00, ImpliedProbability: 12.5, MarketID: 4004, SelectionID: 40004, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 2, "tvl": 360000}},
			{Name: "LAUTARO MARTÍNEZ", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/8/80/Lautaro_Martinez_2025.jpg", CountryCode: "AR", PlayerID: "p_lautaro", Odds: 10.00, ImpliedProbability: 10.0, MarketID: 4005, SelectionID: 40005, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 2, "tvl": 240000}},
			{Name: "LAMINE YAMAL", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Lamine_Yamal_in_2025_%28cropped%29.jpg", CountryCode: "ES", PlayerID: "p_yamal", Odds: 12.00, ImpliedProbability: 8.3, MarketID: 4006, SelectionID: 40006, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 2, "tvl": 310000}},
			{Name: "JULIÁN ÁLVAREZ", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/3/34/Juli%C3%A1n_%C3%81lvarez_%28footballer%29_2023.jpg", CountryCode: "AR", PlayerID: "p_alvarez", Odds: 13.00, ImpliedProbability: 7.7, MarketID: 4007, SelectionID: 40007, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 1, "tvl": 180000}},
			{Name: "BUKAYO SAKA", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/axl31b1769332282.jpg/medium", CountryCode: "GB-ENG", PlayerID: "p_saka", Odds: 15.00, ImpliedProbability: 6.7, MarketID: 4008, SelectionID: 40008, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 1, "tvl": 200000}},
			{Name: "CRISTIANO RONALDO", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/bkre241600892282.jpg/medium", CountryCode: "PT", PlayerID: "p_ronaldo", Odds: 17.00, ImpliedProbability: 5.9, MarketID: 4009, SelectionID: 40009, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 1, "tvl": 480000}},
			{Name: "ANTOINE GRIEZMANN", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/c/cf/Antoine_Griezmann_%2851100409504%29_%28cropped%29.jpg", CountryCode: "FR", PlayerID: "p_griezmann", Odds: 19.00, ImpliedProbability: 5.3, MarketID: 4010, SelectionID: 40010, BetMode: []string{"single"}, Extra: map[string]interface{}{"goals": 1, "tvl": 150000}},
		},
	},
	{
		BannerID:      "bnr_005",
		TemplateID:    "top_golden_glove_name",
		SortOrder:     5,
		IsActive:      true,
		TagText:       "GOLDEN GLOVE",
		TagColor:      "#A855F7",
		Title:         "BEST GOALKEEPER OF THE TOURNAMENT",
		DecorationKey: "golden_glove",
		EndTime:       "2026-07-22 23:59:59",
		Items: []marketBannerItem{
			{Name: "EMILIANO MARTÍNEZ", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/7drp311770201331.jpg/medium", CountryCode: "AR", PlayerID: "p_emartinez", Odds: 4.50, ImpliedProbability: 22.2, MarketID: 5001, SelectionID: 50001, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 31, "tvl": 320000}},
			{Name: "ALISSON BECKER", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/yi6dt21746034945.jpg/medium", CountryCode: "BR", PlayerID: "p_alisson", Odds: 5.50, ImpliedProbability: 18.2, MarketID: 5002, SelectionID: 50002, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 28, "tvl": 260000}},
			{Name: "THIBAUT COURTOIS", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/lc7dlm1771264561.jpg/medium", CountryCode: "BE", PlayerID: "p_courtois", Odds: 6.50, ImpliedProbability: 15.4, MarketID: 5003, SelectionID: 50003, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 25, "tvl": 220000}},
			{Name: "JORDAN PICKFORD", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/m66e5n1771945410.jpg/medium", CountryCode: "GB-ENG", PlayerID: "p_pickford", Odds: 8.00, ImpliedProbability: 12.5, MarketID: 5004, SelectionID: 50004, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 22, "tvl": 160000}},
			{Name: "MIKE MAIGNAN", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Mike_Maignan_2022_Salzburg_vs_AC_Milan_2022-09-06.jpg", CountryCode: "FR", PlayerID: "p_maignan", Odds: 9.00, ImpliedProbability: 11.1, MarketID: 5005, SelectionID: 50005, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 20, "tvl": 140000}},
			{Name: "UNAI SIMÓN", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Unai_Sim%C3%B3n_2025_%28cropped%29.jpg", CountryCode: "ES", PlayerID: "p_simon", Odds: 11.00, ImpliedProbability: 9.1, MarketID: 5006, SelectionID: 50006, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 18, "tvl": 100000}},
			{Name: "DIOGO COSTA", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Diogo_Costa_in_2023.jpg", CountryCode: "PT", PlayerID: "p_diogocosta", Odds: 13.00, ImpliedProbability: 7.7, MarketID: 5007, SelectionID: 50007, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 15, "tvl": 75000}},
			{Name: "MARC-ANDRÉ TER STEGEN", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Marc-Andr%C3%A9_ter_Stegen.jpg", CountryCode: "DE", PlayerID: "p_terstegen", Odds: 15.00, ImpliedProbability: 6.7, MarketID: 5008, SelectionID: 50008, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 14, "tvl": 65000}},
			{Name: "YANN SOMMER", ImageURL: "https://upload.wikimedia.org/wikipedia/commons/b/bf/Yann_Sommer_%28cropped%29.jpg", CountryCode: "CH", PlayerID: "p_sommer", Odds: 19.00, ImpliedProbability: 5.3, MarketID: 5009, SelectionID: 50009, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 12, "tvl": 40000}},
			{Name: "EDERSON", ImageURL: "https://r2.thesportsdb.com/images/media/player/thumb/lqvotq1741317988.jpg/medium", CountryCode: "BR", PlayerID: "p_ederson", Odds: 21.00, ImpliedProbability: 4.8, MarketID: 5010, SelectionID: 5010, BetMode: []string{"single"}, Extra: map[string]interface{}{"saves": 10, "tvl": 35000}},
		},
	},
}

var playerNameB4Translations = map[string]map[string]string{
	// 英文
	"en": {
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"ERLING HAALAND":    "Erling Haaland",
		"HARRY KANE":        "Harry Kane",
		"VINICIUS JR":       "Vinicius Jr",
		"LAUTARO MARTÍNEZ":  "Lautaro Martínez",
		"LAMINE YAMAL":      "Lamine Yamal",
		"JULIÁN ÁLVAREZ":    "Julián Álvarez",
		"BUKAYO SAKA":       "Bukayo Saka",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
		"ANTOINE GRIEZMANN": "Antoine Griezmann",
	},
	// 中文
	"zh": {
		"KYLIAN MBAPPÉ":     "基利安·姆巴佩",
		"ERLING HAALAND":    "埃尔林·哈兰德",
		"HARRY KANE":        "哈里·凯恩",
		"VINICIUS JR":       "维尼修斯·儒尼奥尔",
		"LAUTARO MARTÍNEZ":  "劳塔罗·马丁内斯",
		"LAMINE YAMAL":      "拉明·亚马尔",
		"JULIÁN ÁLVAREZ":    "胡利安·阿尔瓦雷斯",
		"BUKAYO SAKA":       "布卡约·萨卡",
		"CRISTIANO RONALDO": "克里斯蒂亚诺·罗纳尔多",
		"ANTOINE GRIEZMANN": "安东尼·格列兹曼",
	},
	// 葡萄牙语
	"pt": {
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"ERLING HAALAND":    "Erling Haaland",
		"HARRY KANE":        "Harry Kane",
		"VINICIUS JR":       "Vinícius Júnior",
		"LAUTARO MARTÍNEZ":  "Lautaro Martínez",
		"LAMINE YAMAL":      "Lamine Yamal",
		"JULIÁN ÁLVAREZ":    "Julián Álvarez",
		"BUKAYO SAKA":       "Bukayo Saka",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
		"ANTOINE GRIEZMANN": "Antoine Griezmann",
	},
	// 日语
	"ja": {
		"KYLIAN MBAPPÉ":     "キリアン・ムバッペ",
		"ERLING HAALAND":    "エルリング・ハーランド",
		"HARRY KANE":        "ハリー・ケイン",
		"VINICIUS JR":       "ヴィニシウス・ジュニオール",
		"LAUTARO MARTÍNEZ":  "ラウタロ・マルティネス",
		"LAMINE YAMAL":      "ラミネ・ヤマル",
		"JULIÁN ÁLVAREZ":    "フリアン・アルバレス",
		"BUKAYO SAKA":       "ブカヨ・サカ",
		"CRISTIANO RONALDO": "クリスティアーノ・ロナウド",
		"ANTOINE GRIEZMANN": "アントワーヌ・グリーズマン",
	},
	// 西班牙语
	"es": {
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"ERLING HAALAND":    "Erling Haaland",
		"HARRY KANE":        "Harry Kane",
		"VINICIUS JR":       "Vinicius Jr",
		"LAUTARO MARTÍNEZ":  "Lautaro Martínez",
		"LAMINE YAMAL":      "Lamine Yamal",
		"JULIÁN ÁLVAREZ":    "Julián Álvarez",
		"BUKAYO SAKA":       "Bukayo Saka",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
		"ANTOINE GRIEZMANN": "Antoine Griezmann",
	},
	// 土耳其语
	"tr": {
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"ERLING HAALAND":    "Erling Haaland",
		"HARRY KANE":        "Harry Kane",
		"VINICIUS JR":       "Vinicius Jr",
		"LAUTARO MARTÍNEZ":  "Lautaro Martínez",
		"LAMINE YAMAL":      "Lamine Yamal",
		"JULIÁN ÁLVAREZ":    "Julián Álvarez",
		"BUKAYO SAKA":       "Bukayo Saka",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
		"ANTOINE GRIEZMANN": "Antoine Griezmann",
	},
	// 德语
	"de": {
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"ERLING HAALAND":    "Erling Haaland",
		"HARRY KANE":        "Harry Kane",
		"VINICIUS JR":       "Vinicius Jr",
		"LAUTARO MARTÍNEZ":  "Lautaro Martínez",
		"LAMINE YAMAL":      "Lamine Yamal",
		"JULIÁN ÁLVAREZ":    "Julián Álvarez",
		"BUKAYO SAKA":       "Bukayo Saka",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
		"ANTOINE GRIEZMANN": "Antoine Griezmann",
	},
	// 法语
	"fr": {
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"ERLING HAALAND":    "Erling Haaland",
		"HARRY KANE":        "Harry Kane",
		"VINICIUS JR":       "Vinicius Jr",
		"LAUTARO MARTÍNEZ":  "Lautaro Martínez",
		"LAMINE YAMAL":      "Lamine Yamal",
		"JULIÁN ÁLVAREZ":    "Julián Álvarez",
		"BUKAYO SAKA":       "Bukayo Saka",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
		"ANTOINE GRIEZMANN": "Antoine Griezmann",
	},
	// 印地语
	"hi": {
		"KYLIAN MBAPPÉ":     "किलियन एम्बाप्पे",
		"ERLING HAALAND":    "अर्लिंग हालैंड",
		"HARRY KANE":        "हैरी केन",
		"VINICIUS JR":       "विनिसियस जूनियर",
		"LAUTARO MARTÍNEZ":  "लौटारो मार्टीनेज",
		"LAMINE YAMAL":      "लामीन यामाल",
		"JULIÁN ÁLVAREZ":    "जूलियन अल्वरेज",
		"BUKAYO SAKA":       "बुकायो साका",
		"CRISTIANO RONALDO": "क्रिस्टियानो रोनाल्डो",
		"ANTOINE GRIEZMANN": "एंटोन ग्रीज़मैन",
	},
}

var playerNameB5Translations = map[string]map[string]string{
	// 英文（基准KEY）
	"en": {
		"EMILIANO MARTÍNEZ":     "Emiliano Martínez",
		"ALISSON BECKER":        "Alisson Becker",
		"THIBAUT COURTOIS":      "Thibaut Courtois",
		"JORDAN PICKFORD":       "Jordan Pickford",
		"MIKE MAIGNAN":          "Mike Maignan",
		"UNAI SIMÓN":            "Unai Simón",
		"DIOGO COSTA":           "Diogo Costa",
		"MARC-ANDRÉ TER STEGEN": "Marc-André ter Stegen",
		"YANN SOMMER":           "Yann Sommer",
		"EDERSON":               "Ederson",
	},

	// 中文
	"zh": {
		"EMILIANO MARTÍNEZ":     "埃米利亚诺·马丁内斯",
		"ALISSON BECKER":        "阿利松·贝克尔",
		"THIBAUT COURTOIS":      "蒂博·库尔图瓦",
		"JORDAN PICKFORD":       "乔丹·皮克福德",
		"MIKE MAIGNAN":          "迈克·迈尼昂",
		"UNAI SIMÓN":            "乌奈·西蒙",
		"DIOGO COSTA":           "迪奥戈·科斯塔",
		"MARC-ANDRÉ TER STEGEN": "马克-安德烈·特尔施特根",
		"YANN SOMMER":           "扬·索默",
		"EDERSON":               "埃德森",
	},

	// 西班牙语
	"es": {
		"EMILIANO MARTÍNEZ":     "Emiliano Martínez",
		"ALISSON BECKER":        "Alisson Becker",
		"THIBAUT COURTOIS":      "Thibaut Courtois",
		"JORDAN PICKFORD":       "Jordan Pickford",
		"MIKE MAIGNAN":          "Mike Maignan",
		"UNAI SIMÓN":            "Unai Simón",
		"DIOGO COSTA":           "Diogo Costa",
		"MARC-ANDRÉ TER STEGEN": "Marc-André ter Stegen",
		"YANN SOMMER":           "Yann Sommer",
		"EDERSON":               "Ederson",
	},

	// 葡萄牙语
	"pt": {
		"EMILIANO MARTÍNEZ":     "Emiliano Martínez",
		"ALISSON BECKER":        "Alisson Becker",
		"THIBAUT COURTOIS":      "Thibaut Courtois",
		"JORDAN PICKFORD":       "Jordan Pickford",
		"MIKE MAIGNAN":          "Mike Maignan",
		"UNAI SIMÓN":            "Unai Simón",
		"DIOGO COSTA":           "Diogo Costa",
		"MARC-ANDRÉ TER STEGEN": "Marc-André ter Stegen",
		"YANN SOMMER":           "Yann Sommer",
		"EDERSON":               "Ederson",
	},

	// 德语
	"de": {
		"EMILIANO MARTÍNEZ":     "Emiliano Martínez",
		"ALISSON BECKER":        "Alisson Becker",
		"THIBAUT COURTOIS":      "Thibaut Courtois",
		"JORDAN PICKFORD":       "Jordan Pickford",
		"MIKE MAIGNAN":          "Mike Maignan",
		"UNAI SIMÓN":            "Unai Simón",
		"DIOGO COSTA":           "Diogo Costa",
		"MARC-ANDRÉ TER STEGEN": "Marc-André ter Stegen",
		"YANN SOMMER":           "Yann Sommer",
		"EDERSON":               "Ederson",
	},

	// 法语
	"fr": {
		"EMILIANO MARTÍNEZ":     "Emiliano Martínez",
		"ALISSON BECKER":        "Alisson Becker",
		"THIBAUT COURTOIS":      "Thibaut Courtois",
		"JORDAN PICKFORD":       "Jordan Pickford",
		"MIKE MAIGNAN":          "Mike Maignan",
		"UNAI SIMÓN":            "Unai Simón",
		"DIOGO COSTA":           "Diogo Costa",
		"MARC-ANDRÉ TER STEGEN": "Marc-André ter Stegen",
		"YANN SOMMER":           "Yann Sommer",
		"EDERSON":               "Ederson",
	},

	// 日语
	"ja": {
		"EMILIANO MARTÍNEZ":     "エミリアーノ・マルティネス",
		"ALISSON BECKER":        "アリソン・ベッカー",
		"THIBAUT COURTOIS":      "ティボ・クルトワ",
		"JORDAN PICKFORD":       "ジョーダン・ピックフォード",
		"MIKE MAIGNAN":          "ミック・メニャン",
		"UNAI SIMÓN":            "ウナイ・シモン",
		"DIOGO COSTA":           "ディオゴ・コスタ",
		"MARC-ANDRÉ TER STEGEN": "マルク＝アンドレ・テルシュテーゲン",
		"YANN SOMMER":           "ヤン・ゾンマー",
		"EDERSON":               "エデルソン",
	},

	// 土耳其语
	"tr": {
		"EMILIANO MARTÍNEZ":     "Emiliano Martínez",
		"ALISSON BECKER":        "Alisson Becker",
		"THIBAUT COURTOIS":      "Thibaut Courtois",
		"JORDAN PICKFORD":       "Jordan Pickford",
		"MIKE MAIGNAN":          "Mike Maignan",
		"UNAI SIMÓN":            "Unai Simón",
		"DIOGO COSTA":           "Diogo Costa",
		"MARC-ANDRÉ TER STEGEN": "Marc-André ter Stegen",
		"YANN SOMMER":           "Yann Sommer",
		"EDERSON":               "Ederson",
	},

	// 印地语
	"hi": {
		"EMILIANO MARTÍNEZ":     "एमिलियानो मार्टीनेज",
		"ALISSON BECKER":        "एलिसन बेकर",
		"THIBAUT COURTOIS":      "थिबौ कूर्तुआ",
		"JORDAN PICKFORD":       "जॉर्डन पिकफोर्ड",
		"MIKE MAIGNAN":          "माइक मैग्नैन",
		"UNAI SIMÓN":            "उनाई सिमोन",
		"DIOGO COSTA":           "डियोगो कोस्टा",
		"MARC-ANDRÉ TER STEGEN": "मार्क-एंड्रे टेर स्टेगेन",
		"YANN SOMMER":           "यान सोमर",
		"EDERSON":               "एडरसन",
	},
}

var marketBannerTranslations = map[string]map[string]string{
	"zh": {
		"HOT MARKET":                        "热门市场",
		"Who Wins The World Cup ?":          "谁将赢得世界杯？",
		"SPAIN":                             "西班牙",
		"FRANCE":                            "法国",
		"ENGLAND":                           "英格兰",
		"ARGENTINA":                         "阿根廷",
		"PLAYER SPECIAL":                    "球员特别",
		"RONALDO TOTAL GOALS":               "罗纳尔多总进球数",
		"CRISTIANO RONALDO · FWD · #7":      "克里斯蒂亚诺·罗纳尔多 · 前锋 · #7",
		"GOLDEN BALL":                       "金球奖",
		"Who Will Be The MVP ?":             "谁会成为最有价值球员？",
		"GOLDEN BOOT":                       "金靴奖",
		"TOP SCORER OF THE TOURNAMENT":      "赛事最佳射手",
		"GOLDEN GLOVE":                      "金手套奖",
		"BEST GOALKEEPER OF THE TOURNAMENT": "赛事最佳门将",
	},
	"ja": {
		"HOT MARKET":                        "注目マーケット",
		"Who Wins The World Cup ?":          "ワールドカップ優勝はどこ？",
		"SPAIN":                             "スペイン",
		"FRANCE":                            "フランス",
		"ENGLAND":                           "イングランド",
		"ARGENTINA":                         "アルゼンチン",
		"PLAYER SPECIAL":                    "選手スペシャル",
		"RONALDO TOTAL GOALS":               "ロナウド総得点",
		"CRISTIANO RONALDO · FWD · #7":      "クリスティアーノ・ロナウド · FW · #7",
		"GOLDEN BALL":                       "バロンドール",
		"Who Will Be The MVP ?":             "MVPは誰になる？",
		"GOLDEN BOOT":                       "ゴールデンブーツ",
		"TOP SCORER OF THE TOURNAMENT":      "大会得点王",
		"GOLDEN GLOVE":                      "ゴールデングローブ",
		"BEST GOALKEEPER OF THE TOURNAMENT": "大会最優秀ゴールキーパー",
	},
	"es": {
		"HOT MARKET":                        "MERCADO CALIENTE",
		"Who Wins The World Cup ?":          "¿Quién gana la Copa del Mundo?",
		"SPAIN":                             "ESPAÑA",
		"FRANCE":                            "FRANCIA",
		"ENGLAND":                           "INGLATERRA",
		"ARGENTINA":                         "ARGENTINA",
		"PLAYER SPECIAL":                    "ESPECIAL DEL JUGADOR",
		"RONALDO TOTAL GOALS":               "GOLES TOTALES DE RONALDO",
		"CRISTIANO RONALDO · FWD · #7":      "CRISTIANO RONALDO · DEL · #7",
		"GOLDEN BALL":                       "BALÓN DE ORO",
		"Who Will Be The MVP ?":             "¿Quién será el MVP?",
		"GOLDEN BOOT":                       "BOTA DE ORO",
		"TOP SCORER OF THE TOURNAMENT":      "MÁXIMO GOLEADOR DEL TORNEO",
		"GOLDEN GLOVE":                      "GUANTE DE ORO",
		"BEST GOALKEEPER OF THE TOURNAMENT": "MEJOR PORTERO DEL TORNEO",
	},
	"tr": {
		"HOT MARKET":                        "GÖZDE PİYASA",
		"Who Wins The World Cup ?":          "Dünya Kupası'nı kim kazanır?",
		"SPAIN":                             "İSPANYA",
		"FRANCE":                            "FRANSA",
		"ENGLAND":                           "İNGİLTERE",
		"ARGENTINA":                         "ARJANTİN",
		"PLAYER SPECIAL":                    "OYUNCU ÖZELİ",
		"RONALDO TOTAL GOALS":               "RONALDO TOPLAM GOL",
		"CRISTIANO RONALDO · FWD · #7":      "CRISTIANO RONALDO · FORVET · #7",
		"GOLDEN BALL":                       "ALTIN TOP",
		"Who Will Be The MVP ?":             "MVP kim olacak?",
		"GOLDEN BOOT":                       "ALTIN AYAKKABI",
		"TOP SCORER OF THE TOURNAMENT":      "TURNUVANIN EN SKORERİ",
		"GOLDEN GLOVE":                      "ALTIN ELDİVEN",
		"BEST GOALKEEPER OF THE TOURNAMENT": "TURNUVANIN EN İYİ KALECİSİ",
	},
	"de": {
		"HOT MARKET":                        "TOP-MARKT",
		"Who Wins The World Cup ?":          "Wer gewinnt die Weltmeisterschaft?",
		"SPAIN":                             "SPANIEN",
		"FRANCE":                            "FRANKREICH",
		"ENGLAND":                           "ENGLAND",
		"ARGENTINA":                         "ARGENTINIEN",
		"PLAYER SPECIAL":                    "SPIELER-SPECIAL",
		"RONALDO TOTAL GOALS":               "RONALDOS TORE INSGESAMT",
		"CRISTIANO RONALDO · FWD · #7":      "CRISTIANO RONALDO · STU · #7",
		"GOLDEN BALL":                       "GOLDENER BALL",
		"Who Will Be The MVP ?":             "Wer wird MVP?",
		"GOLDEN BOOT":                       "GOLDENER SCHUH",
		"TOP SCORER OF THE TOURNAMENT":      "BESTER TORSCHÜTZE DES TURNIERS",
		"GOLDEN GLOVE":                      "GOLDENER HANDSCHUH",
		"BEST GOALKEEPER OF THE TOURNAMENT": "BESTER TORHÜTER DES TURNIERS",
	},
	"fr": {
		"HOT MARKET":                        "MARCHÉ PHARE",
		"Who Wins The World Cup ?":          "Qui remporte la Coupe du monde ?",
		"SPAIN":                             "ESPAGNE",
		"FRANCE":                            "FRANCE",
		"ENGLAND":                           "ANGLETERRE",
		"ARGENTINA":                         "ARGENTINE",
		"PLAYER SPECIAL":                    "SPÉCIAL JOUEUR",
		"RONALDO TOTAL GOALS":               "TOTAL DE BUTS DE RONALDO",
		"CRISTIANO RONALDO · FWD · #7":      "CRISTIANO RONALDO · ATT · #7",
		"GOLDEN BALL":                       "BALLON D'OR",
		"Who Will Be The MVP ?":             "Qui sera le MVP ?",
		"GOLDEN BOOT":                       "SOULIER D'OR",
		"TOP SCORER OF THE TOURNAMENT":      "MEILLEUR BUTEUR DU TOURNOI",
		"GOLDEN GLOVE":                      "GANT D'OR",
		"BEST GOALKEEPER OF THE TOURNAMENT": "MEILLEUR GARDIEN DU TOURNOI",
	},
	"hi": {
		"HOT MARKET":                        "हॉट मार्केट",
		"Who Wins The World Cup ?":          "विश्व कप कौन जीतेगा?",
		"SPAIN":                             "स्पेन",
		"FRANCE":                            "फ्रांस",
		"ENGLAND":                           "इंग्लैंड",
		"ARGENTINA":                         "अर्जेंटीना",
		"PLAYER SPECIAL":                    "प्लेयर स्पेशल",
		"RONALDO TOTAL GOALS":               "रोनाल्डो के कुल गोल",
		"CRISTIANO RONALDO · FWD · #7":      "क्रिस्टियानो रोनाल्डो · फॉरवर्ड · #7",
		"GOLDEN BALL":                       "गोल्डन बॉल",
		"Who Will Be The MVP ?":             "MVP कौन बनेगा?",
		"GOLDEN BOOT":                       "गोल्डन बूट",
		"TOP SCORER OF THE TOURNAMENT":      "टूर्नामेंट का शीर्ष स्कोरर",
		"GOLDEN GLOVE":                      "गोल्डन ग्लव",
		"BEST GOALKEEPER OF THE TOURNAMENT": "टूर्नामेंट का सर्वश्रेष्ठ गोलकीपर",
	},
	"pt": {
		"HOT MARKET":                        "MERCADO QUENTE",
		"Who Wins The World Cup ?":          "Quem vence a Copa do Mundo?",
		"SPAIN":                             "ESPANHA",
		"FRANCE":                            "FRANÇA",
		"ENGLAND":                           "INGLATERRA",
		"ARGENTINA":                         "ARGENTINA",
		"PLAYER SPECIAL":                    "ESPECIAL DO JOGADOR",
		"RONALDO TOTAL GOALS":               "GOLS TOTAIS DE RONALDO",
		"CRISTIANO RONALDO · FWD · #7":      "CRISTIANO RONALDO · ATA · #7",
		"GOLDEN BALL":                       "BOLA DE OURO",
		"Who Will Be The MVP ?":             "Quem será o MVP?",
		"GOLDEN BOOT":                       "CHUTEIRA DE OURO",
		"TOP SCORER OF THE TOURNAMENT":      "ARTILHEIRO DO TORNEIO",
		"GOLDEN GLOVE":                      "LUVA DE OURO",
		"BEST GOALKEEPER OF THE TOURNAMENT": "MELHOR GOLEIRO DO TORNEIO",
	},
}

var marketBannerNameTranslations = map[string]map[string]string{
	"en": { // 英文
		"SPAIN":       "Spain",
		"FRANCE":      "France",
		"ENGLAND":     "England",
		"ARGENTINA":   "Argentina",
		"BRAZIL":      "Brazil",
		"GERMANY":     "Germany",
		"PORTUGAL":    "Portugal",
		"NETHERLANDS": "Netherlands",
		"ITALY":       "Italy",
		"NORWAY":      "Norway",
	},
	"zh": { // 中文
		"SPAIN":       "西班牙",
		"FRANCE":      "法国",
		"ENGLAND":     "英格兰",
		"ARGENTINA":   "阿根廷",
		"BRAZIL":      "巴西",
		"GERMANY":     "德国",
		"PORTUGAL":    "葡萄牙",
		"NETHERLANDS": "荷兰",
		"ITALY":       "意大利",
		"NORWAY":      "挪威",
	},
	"es": { // 西班牙语
		"SPAIN":       "España",
		"FRANCE":      "Francia",
		"ENGLAND":     "Inglaterra",
		"ARGENTINA":   "Argentina",
		"BRAZIL":      "Brasil",
		"GERMANY":     "Alemania",
		"PORTUGAL":    "Portugal",
		"NETHERLANDS": "Países Bajos",
		"ITALY":       "Italia",
		"NORWAY":      "Noruega",
	},
	"pt": { // 葡萄牙语
		"SPAIN":       "Espanha",
		"FRANCE":      "França",
		"ENGLAND":     "Inglaterra",
		"ARGENTINA":   "Argentina",
		"BRAZIL":      "Brasil",
		"GERMANY":     "Alemanha",
		"PORTUGAL":    "Portugal",
		"NETHERLANDS": "Holanda",
		"ITALY":       "Itália",
		"NORWAY":      "Noruega",
	},
	"de": { // 德语
		"SPAIN":       "Spanien",
		"FRANCE":      "Frankreich",
		"ENGLAND":     "England",
		"ARGENTINA":   "Argentinien",
		"BRAZIL":      "Brasilien",
		"GERMANY":     "Deutschland",
		"PORTUGAL":    "Portugal",
		"NETHERLANDS": "Niederlande",
		"ITALY":       "Italien",
		"NORWAY":      "Norwegen",
	},
	"fr": { // 法语
		"SPAIN":       "Espagne",
		"FRANCE":      "France",
		"ENGLAND":     "Angleterre",
		"ARGENTINA":   "Argentine",
		"BRAZIL":      "Brésil",
		"GERMANY":     "Allemagne",
		"PORTUGAL":    "Portugal",
		"NETHERLANDS": "Pays-Bas",
		"ITALY":       "Italie",
		"NORWAY":      "Norvège",
	},
	"ja": { // 日语
		"SPAIN":       "スペイン",
		"FRANCE":      "フランス",
		"ENGLAND":     "イングランド",
		"ARGENTINA":   "アルゼンチン",
		"BRAZIL":      "ブラジル",
		"GERMANY":     "ドイツ",
		"PORTUGAL":    "ポルトガル",
		"NETHERLANDS": "オランダ",
		"ITALY":       "イタリア",
		"NORWAY":      "ノルウェー",
	},
	"tr": { // 土耳其语
		"SPAIN":       "İspanya",
		"FRANCE":      "Fransa",
		"ENGLAND":     "İngiltere",
		"ARGENTINA":   "Arjantin",
		"BRAZIL":      "Brezilya",
		"GERMANY":     "Almanya",
		"PORTUGAL":    "Portekiz",
		"NETHERLANDS": "Hollanda",
		"ITALY":       "İtalya",
		"NORWAY":      "Norveç",
	},
	"hi": { // 印地语
		"SPAIN":       "स्पेन",
		"FRANCE":      "फ्रांस",
		"ENGLAND":     "इंग्लैंड",
		"ARGENTINA":   "अर्जेंटीना",
		"BRAZIL":      "ब्राजील",
		"GERMANY":     "जर्मनी",
		"PORTUGAL":    "पुर्तगाल",
		"NETHERLANDS": "नीदरलैंड",
		"ITALY":       "इटली",
		"NORWAY":      "नॉर्वे",
	},
}

var playerNameTranslations = map[string]map[string]string{
	"en": {
		"JUDE BELLINGHAM":   "Jude Bellingham",
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"LAMINE YAMAL":      "Lamine Yamal",
		"VINICIUS JR":       "Vinicius Jr",
		"LIONEL MESSI":      "Lionel Messi",
		"RODRI":             "Rodri",
		"FLORIAN WIRTZ":     "Florian Wirtz",
		"PEDRI":             "Pedri",
		"PHIL FODEN":        "Phil Foden",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
	},
	"zh": {
		"JUDE BELLINGHAM":   "裘德·贝林厄姆",
		"KYLIAN MBAPPÉ":     "基利安·姆巴佩",
		"LAMINE YAMAL":      "拉明·亚马尔",
		"VINICIUS JR":       "维尼修斯·儒尼奥尔",
		"LIONEL MESSI":      "利昂内尔·梅西",
		"RODRI":             "罗德里",
		"FLORIAN WIRTZ":     "弗洛里安·维尔茨",
		"PEDRI":             "佩德里",
		"PHIL FODEN":        "菲尔·福登",
		"CRISTIANO RONALDO": "克里斯蒂亚诺·罗纳尔多",
	},
	"pt": {
		"JUDE BELLINGHAM":   "Jude Bellingham",
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"LAMINE YAMAL":      "Lamine Yamal",
		"VINICIUS JR":       "Vinícius Júnior",
		"LIONEL MESSI":      "Lionel Messi",
		"RODRI":             "Rodri",
		"FLORIAN WIRTZ":     "Florian Wirtz",
		"PEDRI":             "Pedri",
		"PHIL FODEN":        "Phil Foden",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
	},
	"ja": {
		"JUDE BELLINGHAM":   "ジュード・ベリンガム",
		"KYLIAN MBAPPÉ":     "キリアン・ムバッペ",
		"LAMINE YAMAL":      "ラミネ・ヤマル",
		"VINICIUS JR":       "ヴィニシウス・ジュニオール",
		"LIONEL MESSI":      "リオネル・メッシ",
		"RODRI":             "ロドリ",
		"FLORIAN WIRTZ":     "フローリアン・ヴィルツ",
		"PEDRI":             "ペドリ",
		"PHIL FODEN":        "フィル・フォーデン",
		"CRISTIANO RONALDO": "クリスティアーノ・ロナウド",
	},
	"es": {
		"JUDE BELLINGHAM":   "Jude Bellingham",
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"LAMINE YAMAL":      "Lamine Yamal",
		"VINICIUS JR":       "Vinicius Jr",
		"LIONEL MESSI":      "Lionel Messi",
		"RODRI":             "Rodri",
		"FLORIAN WIRTZ":     "Florian Wirtz",
		"PEDRI":             "Pedri",
		"PHIL FODEN":        "Phil Foden",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
	},
	"tr": {
		"JUDE BELLINGHAM":   "Jude Bellingham",
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"LAMINE YAMAL":      "Lamine Yamal",
		"VINICIUS JR":       "Vinicius Jr",
		"LIONEL MESSI":      "Lionel Messi",
		"RODRI":             "Rodri",
		"FLORIAN WIRTZ":     "Florian Wirtz",
		"PEDRI":             "Pedri",
		"PHIL FODEN":        "Phil Foden",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
	},
	"de": {
		"JUDE BELLINGHAM":   "Jude Bellingham",
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"LAMINE YAMAL":      "Lamine Yamal",
		"VINICIUS JR":       "Vinicius Jr",
		"LIONEL MESSI":      "Lionel Messi",
		"RODRI":             "Rodri",
		"FLORIAN WIRTZ":     "Florian Wirtz",
		"PEDRI":             "Pedri",
		"PHIL FODEN":        "Phil Foden",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
	},
	"fr": {
		"JUDE BELLINGHAM":   "Jude Bellingham",
		"KYLIAN MBAPPÉ":     "Kylian Mbappé",
		"LAMINE YAMAL":      "Lamine Yamal",
		"VINICIUS JR":       "Vinicius Jr",
		"LIONEL MESSI":      "Lionel Messi",
		"RODRI":             "Rodri",
		"FLORIAN WIRTZ":     "Florian Wirtz",
		"PEDRI":             "Pedri",
		"PHIL FODEN":        "Phil Foden",
		"CRISTIANO RONALDO": "Cristiano Ronaldo",
	},
	"hi": {
		"JUDE BELLINGHAM":   "जूड बेलिंघम",
		"KYLIAN MBAPPÉ":     "किलियन एम्बाप्पे",
		"LAMINE YAMAL":      "लामीन यामाल",
		"VINICIUS JR":       "विनिसियस जूनियर",
		"LIONEL MESSI":      "लियोनेल मेस्सी",
		"RODRI":             "रोड्री",
		"FLORIAN WIRTZ":     "फ्लोरियन विर्ट्ज",
		"PEDRI":             "पेड्री",
		"PHIL FODEN":        "फिल फोडेन",
		"CRISTIANO RONALDO": "क्रिस्टियानो रोनाल्डो",
	},
}

var marketBannerEntityTranslations = map[string]map[string]string{
	"zh": {
		"BRAZIL":      "巴西",
		"GERMANY":     "德国",
		"PORTUGAL":    "葡萄牙",
		"NETHERLANDS": "荷兰",
		"ITALY":       "意大利",
		"NORWAY":      "挪威",
		"BELLINGHAM":  "贝林厄姆",
		"MBAPPÉ":      "姆巴佩",
		"YAMAL":       "亚马尔",
		"VINICIUS JR": "维尼修斯",
		"HAALAND":     "哈兰德",
		"KANE":        "凯恩",
		"E. MARTÍNEZ": "马丁内斯",
		"ALISSON":     "阿利松",
		"COURTOIS":    "库尔图瓦",
		"PICKFORD":    "皮克福德",
		"MESSI":       "梅西",
		"RODRI":       "罗德里",
		"WIRTZ":       "维尔茨",
		"PEDRI":       "佩德里",
		"FODEN":       "福登",
		"RONALDO":     "罗纳尔多",
		"LAUTARO":     "劳塔罗",
		"ALVAREZ":     "阿尔瓦雷斯",
		"SAKA":        "萨卡",
		"GRIEZMANN":   "格列兹曼",
		"MAIGNAN":     "迈尼昂",
		"SIMÓN":       "西蒙",
		"D. COSTA":    "迪奥戈·科斯塔",
		"TER STEGEN":  "特尔施特根",
		"SOMMER":      "索默",
		"EDERSON":     "埃德森",
	},
	"ja": {
		"BRAZIL":      "ブラジル",
		"GERMANY":     "ドイツ",
		"PORTUGAL":    "ポルトガル",
		"NETHERLANDS": "オランダ",
		"ITALY":       "イタリア",
		"NORWAY":      "ノルウェー",
		"BELLINGHAM":  "ベリンガム",
		"MBAPPÉ":      "エムバペ",
		"YAMAL":       "ヤマル",
		"VINICIUS JR": "ヴィニシウス Jr",
		"HAALAND":     "ハーランド",
		"KANE":        "ケイン",
		"E. MARTÍNEZ": "E. マルティネス",
		"ALISSON":     "アリソン",
		"COURTOIS":    "クルトワ",
		"PICKFORD":    "ピックフォード",
		"MESSI":       "メッシ",
		"RODRI":       "ロドリ",
		"WIRTZ":       "ヴィルツ",
		"PEDRI":       "ペドリ",
		"FODEN":       "フォーデン",
		"RONALDO":     "ロナウド",
		"LAUTARO":     "ラウタロ",
		"ALVAREZ":     "アルバレス",
		"SAKA":        "サカ",
		"GRIEZMANN":   "グリーズマン",
		"MAIGNAN":     "メニャン",
		"SIMÓN":       "シモン",
		"D. COSTA":    "D. コスタ",
		"TER STEGEN":  "テア・シュテーゲン",
		"SOMMER":      "ゾマー",
		"EDERSON":     "エデルソン",
	},
	"es": {
		"BRAZIL":      "BRASIL",
		"GERMANY":     "ALEMANIA",
		"PORTUGAL":    "PORTUGAL",
		"NETHERLANDS": "PAÍSES BAJOS",
		"ITALY":       "ITALIA",
		"NORWAY":      "NORUEGA",
	},
	"tr": {
		"BRAZIL":      "BREZİLYA",
		"GERMANY":     "ALMANYA",
		"PORTUGAL":    "PORTEKİZ",
		"NETHERLANDS": "HOLLANDA",
		"ITALY":       "İTALYA",
		"NORWAY":      "NORVEÇ",
	},
	"de": {
		"BRAZIL":      "BRASILIEN",
		"GERMANY":     "DEUTSCHLAND",
		"PORTUGAL":    "PORTUGAL",
		"NETHERLANDS": "NIEDERLANDE",
		"ITALY":       "ITALIEN",
		"NORWAY":      "NORWEGEN",
	},
	"fr": {
		"BRAZIL":      "BRÉSIL",
		"GERMANY":     "ALLEMAGNE",
		"PORTUGAL":    "PORTUGAL",
		"NETHERLANDS": "PAYS-BAS",
		"ITALY":       "ITALIE",
		"NORWAY":      "NORVÈGE",
	},
	"hi": {
		"BRAZIL":      "ब्राज़ील",
		"GERMANY":     "जर्मनी",
		"PORTUGAL":    "पुर्तगाल",
		"NETHERLANDS": "नीदरलैंड्स",
		"ITALY":       "इटली",
		"NORWAY":      "नॉर्वे",
		"BELLINGHAM":  "बेलिंगहैम",
		"MBAPPÉ":      "एमबाप्पे",
		"YAMAL":       "यामाल",
		"VINICIUS JR": "विनीसियस जूनियर",
		"HAALAND":     "हालांड",
		"KANE":        "केन",
		"E. MARTÍNEZ": "ई. मार्टिनेज़",
		"ALISSON":     "एलिसन",
		"COURTOIS":    "कूर्तुआ",
		"PICKFORD":    "पिकफोर्ड",
		"MESSI":       "मेसी",
		"RODRI":       "रोद्री",
		"WIRTZ":       "विर्ट्ज़",
		"PEDRI":       "पेद्री",
		"FODEN":       "फोडेन",
		"RONALDO":     "रोनाल्डो",
		"LAUTARO":     "लौतारो",
		"ALVAREZ":     "अल्वारेज़",
		"SAKA":        "साका",
		"GRIEZMANN":   "ग्रिज़मैन",
		"MAIGNAN":     "मैगनां",
		"SIMÓN":       "सिमोन",
		"D. COSTA":    "डी. कोस्टा",
		"TER STEGEN":  "टेर स्टेगन",
		"SOMMER":      "सोम्मर",
		"EDERSON":     "एडरसन",
	},
	"pt": {
		"BRAZIL":      "BRASIL",
		"GERMANY":     "ALEMANHA",
		"PORTUGAL":    "PORTUGAL",
		"NETHERLANDS": "PAÍSES BAIXOS",
		"ITALY":       "ITÁLIA",
		"NORWAY":      "NORUEGA",
	},
}

func GetMarketBanners(c *gin.Context) {
	lang := normalizeBannerLang(c.DefaultQuery("lang", "en"))

	c.JSON(http.StatusOK, marketBannerResponse{
		Code: 0,
		Data: buildLocalizedMarketBanners(lang),
	})
}

func GetMarketBannerDetail(c *gin.Context) {
	bannerID := c.Param("banner_id")
	// 补充具体逻辑
	/*
		b1
		b2
		b3
		b4
		b5
	*/
	log.Println("[GetMarketBannerDetail] bannerID: ", bannerID)
	if bannerID == "" {
		c.JSON(http.StatusBadRequest, model.Response{
			Code: 400,
			Msg:  "banner_id 参数缺少",
			Data: nil,
		})
		return
	}

	lang := normalizeBannerLang(c.DefaultQuery("lang", "en"))
	// 直接返回对应的 Banner 数据

	// 对于 B1 /B2 /B3 返回如下数据
	var banner []marketBannerItem
	for _, b := range marketBannerBaseData {
		if b.TemplateID == bannerID {
			banner = b.Items
			break
		}
	}
	if bannerID == "top_wins_the_world_cup" {
		banner = translateBannerItems(banner, lang)
	}
	if bannerID == "top_golden_ball_name" {
		banner = translateBannerPlayerItems(banner, lang, "b3")
	}
	if bannerID == "top_golden_boot_name" {
		banner = translateBannerPlayerItems(banner, lang, "b4")
	}
	if bannerID == "top_golden_glove_name" {
		banner = translateBannerPlayerItems(banner, lang, "b5")
	}
	c.JSON(http.StatusOK, model.Response{
		Code: 200,
		Data: banner,
		Msg:  "success",
	})
}

func translateBannerItems(items []marketBannerItem, lang string) []marketBannerItem {
	localized := make([]marketBannerItem, 0, len(items))
	for _, item := range items {
		item.Name = marketBannerNameTranslations[lang][item.Name]
		localized = append(localized, item)
	}
	return localized
}

func translateBannerPlayerItems(items []marketBannerItem, lang string, id string) []marketBannerItem {
	localized := make([]marketBannerItem, 0, len(items))
	for _, item := range items {
		if id == "b3" {
			item.Name = playerNameTranslations[lang][item.Name]
		} else if id == "b4" {
			item.Name = playerNameB4Translations[lang][item.Name]
		} else if id == "b5" {
			item.Name = playerNameB5Translations[lang][item.Name]
		}
		localized = append(localized, item)
	}
	return localized
}

func buildLocalizedMarketBanners(lang string) []marketBanner {
	localized := make([]marketBanner, 0, len(marketBannerBaseData))
	for _, banner := range marketBannerBaseData {
		newBanner := marketBanner{
			BannerID:      banner.BannerID,
			TemplateID:    banner.TemplateID,
			SortOrder:     banner.SortOrder,
			IsActive:      banner.IsActive,
			TagText:       translateBannerText(lang, banner.TagText),
			TagColor:      banner.TagColor,
			Title:         translateBannerText(lang, banner.Title),
			DecorationKey: banner.DecorationKey,
			Items:         make([]marketBannerItem, 0, len(banner.Items)),
			EndTime:       banner.EndTime,
		}
		if banner.Subtitle != nil {
			newBanner.Subtitle = stringPtr(translateBannerText(lang, *banner.Subtitle))
		}

		for _, item := range banner.Items {
			newBanner.Items = append(newBanner.Items, marketBannerItem{
				Name:               translateBannerItemName(lang, banner.TemplateID, item.Name),
				CountryCode:        item.CountryCode,
				PlayerID:           item.PlayerID,
				Odds:               item.Odds,
				ImpliedProbability: item.ImpliedProbability,
				MarketID:           item.MarketID,
				SelectionID:        item.SelectionID,
				BetMode:            append([]string(nil), item.BetMode...),
				Extra:              cloneBannerExtra(item.Extra),
			})
		}

		localized = append(localized, newBanner)
	}

	return localized
}

func translateBannerItemName(lang, templateID, name string) string {
	// 球员类 Banner 的 name 是完整球员名，不能走通用短实体翻译表，否则会因为 key 不匹配回落到英文。
	if translated, ok := translateBannerPlayerNameByTemplate(lang, templateID, name); ok {
		return translated
	}
	return translateBannerText(lang, name)
}

func translateBannerPlayerNameByTemplate(lang, templateID, name string) (string, bool) {
	// 英文列表接口历史上直接返回基准文案，这里只修复非英文翻译缺失，避免改变现有英文返回形态。
	if lang == "en" {
		return "", false
	}

	var translations map[string]map[string]string
	switch templateID {
	case "top_golden_ball_name":
		translations = playerNameTranslations
	case "top_golden_boot_name":
		translations = playerNameB4Translations
	case "top_golden_glove_name":
		translations = playerNameB5Translations
	default:
		return "", false
	}

	langTranslations, ok := translations[lang]
	if !ok {
		return "", false
	}
	translated, ok := langTranslations[name]
	return translated, ok
}

func normalizeBannerLang(lang string) string {
	lang = strings.ToLower(strings.TrimSpace(lang))
	if _, ok := supportedBannerLangs[lang]; ok {
		return lang
	}
	return "en"
}

func translateBannerText(lang, text string) string {
	if lang == "en" {
		return text
	}
	if translated, ok := marketBannerTranslations[lang][text]; ok {
		return translated
	}
	if translated, ok := marketBannerEntityTranslations[lang][text]; ok {
		return translated
	}
	if translated, ok := translateGoalLabel(lang, text); ok {
		return translated
	}
	return text
}

func translateGoalLabel(lang, text string) (string, bool) {
	parts := strings.Fields(text)
	if len(parts) != 2 {
		return "", false
	}
	if parts[1] != "goal" && parts[1] != "goals" {
		return "", false
	}

	amount := parts[0]
	singular := amount == "1"
	if strings.HasSuffix(amount, "+") {
		singular = false
	}
	numericPart := strings.TrimSuffix(amount, "+")
	if _, err := strconv.Atoi(numericPart); err != nil {
		return "", false
	}

	switch lang {
	case "zh":
		return amount + "球", true
	case "ja":
		return amount + "ゴール", true
	case "es":
		if singular {
			return amount + " gol", true
		}
		return amount + " goles", true
	case "tr":
		return amount + " gol", true
	case "de":
		if singular {
			return amount + " Tor", true
		}
		return amount + " Tore", true
	case "fr":
		if singular {
			return amount + " but", true
		}
		return amount + " buts", true
	case "hi":
		return amount + " गोल", true
	case "pt":
		if singular {
			return amount + " gol", true
		}
		return amount + " gols", true
	default:
		return "", false
	}
}

func cloneBannerExtra(extra map[string]interface{}) map[string]interface{} {
	if extra == nil {
		return nil
	}
	cloned := make(map[string]interface{}, len(extra))
	for key, value := range extra {
		cloned[key] = value
	}
	return cloned
}

func stringPtr(value string) *string {
	return &value
}
