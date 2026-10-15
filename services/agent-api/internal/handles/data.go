package handles

import "strings"

type Handle struct {
	Handle      string // 含 @
	NameCn      string
	NameEn      string
	Category    string // 官方 | 记者 | 媒体 | 数据 | 东道主 | 评论
	Language    string // en | es | it | de | fr
	Description string
	URL         string
}

// List 30 个 Twitter handle，按 CSV 顺序
var List = []Handle{
	{Handle: "@FIFAWorldCup", NameCn: "FIFA世界杯官方", NameEn: "FIFA World Cup", Category: "官方", Language: "en", Description: "国际足联世界杯官方账号，赛程、抽签、规则变更第一来源", URL: "https://twitter.com/FIFAWorldCup"},
	{Handle: "@FIFAcom", NameCn: "FIFA官方", NameEn: "FIFA", Category: "官方", Language: "en", Description: "FIFA主账号，治理层面、转播权、争议事件", URL: "https://twitter.com/FIFAcom"},
	{Handle: "@FIFAMedia", NameCn: "FIFA媒体部", NameEn: "FIFA Media", Category: "官方", Language: "en", Description: "新闻稿、发布会通告，记者类信息源头", URL: "https://twitter.com/FIFAMedia"},
	{Handle: "@FIFAcom_es", NameCn: "FIFA西语官方", NameEn: "FIFA Espanol", Category: "官方", Language: "es", Description: "西语世界覆盖，拉美球迷和媒体聚集地", URL: "https://twitter.com/FIFAcom_es"},
	{Handle: "@CONMEBOL", NameCn: "南美足联", NameEn: "CONMEBOL", Category: "官方", Language: "es", Description: "南美足联，巴西阿根廷乌拉圭等强队动态", URL: "https://twitter.com/CONMEBOL"},
	{Handle: "@UEFAcom_en", NameCn: "欧足联英文", NameEn: "UEFA", Category: "官方", Language: "en", Description: "欧足联，欧洲球队预选赛友谊赛伤病通报", URL: "https://twitter.com/UEFAcom_en"},
	{Handle: "@Concacaf", NameCn: "北中美及加勒比足联", NameEn: "Concacaf", Category: "官方", Language: "en", Description: "东道主区域消息，对2026世界杯尤其重要", URL: "https://twitter.com/Concacaf"},
	{Handle: "@FabrizioRomano", NameCn: "法布里齐奥·罗马诺", NameEn: "Fabrizio Romano", Category: "记者", Language: "en", Description: "全球转会和突发第一来源，2700万+粉丝", URL: "https://twitter.com/FabrizioRomano"},
	{Handle: "@David_Ornstein", NameCn: "大卫·奥恩斯坦", NameEn: "David Ornstein", Category: "记者", Language: "en", Description: "The Athletic，英伦体系内最可信记者", URL: "https://twitter.com/David_Ornstein"},
	{Handle: "@DiMarzio", NameCn: "吉安卢卡·迪马尔齐奥", NameEn: "Gianluca Di Marzio", Category: "记者", Language: "it", Description: "Sky Italia，意甲和南欧消息核心", URL: "https://twitter.com/DiMarzio"},
	{Handle: "@MarioCortegana", NameCn: "马里奥·科尔特加纳", NameEn: "Mario Cortegana", Category: "记者", Language: "es", Description: "西班牙转会、皇马巴萨核心爆料人", URL: "https://twitter.com/MarioCortegana"},
	{Handle: "@MatteMoretto", NameCn: "马特奥·莫雷托", NameEn: "Matteo Moretto", Category: "记者", Language: "es", Description: "Relevo，新生代爆料记者速度极快", URL: "https://twitter.com/MatteMoretto"},
	{Handle: "@Plettigoal", NameCn: "弗洛里安·普莱滕贝格", NameEn: "Florian Plettenberg", Category: "记者", Language: "de", Description: "Sky Germany，德甲与德国队", URL: "https://twitter.com/Plettigoal"},
	{Handle: "@lequipe", NameCn: "队报", NameEn: "L'Equipe", Category: "记者", Language: "fr", Description: "法国体育权威媒体，法国队和法甲一手信息", URL: "https://twitter.com/lequipe"},
	{Handle: "@goal", NameCn: "Goal足球网", NameEn: "Goal", Category: "媒体", Language: "en", Description: "全球足球新闻聚合，1000万+粉丝", URL: "https://twitter.com/goal"},
	{Handle: "@ESPNFC", NameCn: "ESPN足球频道", NameEn: "ESPN FC", Category: "媒体", Language: "en", Description: "美洲视角强，对北美世界杯尤其重要", URL: "https://twitter.com/ESPNFC"},
	{Handle: "@BBCSport", NameCn: "BBC体育", NameEn: "BBC Sport", Category: "媒体", Language: "en", Description: "BBC体育，英国与世界杯权威报道", URL: "https://twitter.com/BBCSport"},
	{Handle: "@SkySportsNews", NameCn: "天空体育新闻", NameEn: "Sky Sports News", Category: "媒体", Language: "en", Description: "突发英文新闻速度极快", URL: "https://twitter.com/SkySportsNews"},
	{Handle: "@TheAthleticFC", NameCn: "The Athletic足球", NameEn: "The Athletic FC", Category: "媒体", Language: "en", Description: "深度报道与独家", URL: "https://twitter.com/TheAthleticFC"},
	{Handle: "@FourFourTwo", NameCn: "442杂志", NameEn: "FourFourTwo", Category: "媒体", Language: "en", Description: "长读、专题、历史背景", URL: "https://twitter.com/FourFourTwo"},
	{Handle: "@brfootball", NameCn: "Bleacher Report足球", NameEn: "B/R Football", Category: "媒体", Language: "en", Description: "社交媒体话题驱动，年轻受众聚集地", URL: "https://twitter.com/brfootball"},
	{Handle: "@guardian_sport", NameCn: "卫报体育", NameEn: "Guardian Sport", Category: "媒体", Language: "en", Description: "世界杯专题质量高", URL: "https://twitter.com/guardian_sport"},
	{Handle: "@OptaJoe", NameCn: "Opta官方", NameEn: "OptaJoe", Category: "数据", Language: "en", Description: "赛场实时数据和历史对比", URL: "https://twitter.com/OptaJoe"},
	{Handle: "@WhoScored", NameCn: "WhoScored评分网", NameEn: "WhoScored", Category: "数据", Language: "en", Description: "球员评分、阵容数据", URL: "https://twitter.com/WhoScored"},
	{Handle: "@11tegen11", NameCn: "11tegen11战术", NameEn: "11tegen11", Category: "数据", Language: "en", Description: "战术与xG分析", URL: "https://twitter.com/11tegen11"},
	{Handle: "@USMNT", NameCn: "美国男足国家队", NameEn: "USMNT", Category: "东道主", Language: "en", Description: "东道主之一，赛前热度持续高", URL: "https://twitter.com/USMNT"},
	{Handle: "@miseleccionmx", NameCn: "墨西哥国家队", NameEn: "Mi Seleccion MX", Category: "东道主", Language: "es", Description: "墨西哥国家队官方", URL: "https://twitter.com/miseleccionmx"},
	{Handle: "@CanadaSoccerEN", NameCn: "加拿大国家队", NameEn: "Canada Soccer", Category: "东道主", Language: "en", Description: "加拿大国家队官方英文账号", URL: "https://twitter.com/CanadaSoccerEN"},
	{Handle: "@TaylorTwellman", NameCn: "泰勒·特维尔曼", NameEn: "Taylor Twellman", Category: "评论", Language: "en", Description: "美国本土最具影响力的足球评论员", URL: "https://twitter.com/TaylorTwellman"},
	{Handle: "@henrywinter", NameCn: "亨利·温特", NameEn: "Henry Winter", Category: "评论", Language: "en", Description: "资深英国足球记者，世界杯长期驻场报道", URL: "https://twitter.com/henrywinter"},
}

var byHandle = func() map[string]*Handle {
	m := make(map[string]*Handle, len(List)*2)
	for i := range List {
		h := &List[i]
		m[strings.ToLower(h.Handle)] = h
		if strings.HasPrefix(h.Handle, "@") {
			m[strings.ToLower(h.Handle[1:])] = h
		}
	}
	return m
}()

// Lookup 大小写不敏感、可带或不带 @
func Lookup(handle string) *Handle {
	key := strings.ToLower(strings.TrimPrefix(handle, "@"))
	return byHandle[key]
}
