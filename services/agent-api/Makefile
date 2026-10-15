.PHONY: run tidy inject inject-card

run:
	go run .

tidy:
	go mod tidy

# 注入一条原始 tweet → Kimi 解析 → 存入推送卡
inject:
	@curl -sS -X POST http://localhost:8080/api/dev/inject-tweet \
		-H 'Content-Type: application/json' \
		-d '{"handle":"@FabrizioRomano","post":{"id":"test_001","type":"post","text":"BREAKING: Real Madrid have agreed personal terms with Alphonso Davies for a free transfer in summer 2026. Bayern not happy. Here we go soon.","author":{"id":"330262748","handle":"@FabrizioRomano","name":"Fabrizio Romano"}}}' | jq

# 直接注入成型 PushCard（跳过 Kimi）
inject-card:
	@curl -sS -X POST http://localhost:8080/api/dev/inject \
		-H 'Content-Type: application/json' \
		-d '{"tag":"odds","tagLabel":"赔率剧变","title":"Test Card","source":"🐦 @Test","sourceUrl":"x.com/test","aiAnalysis":{"change":"测试","priceImpact":"<b class=\"delta-up\">+5%</b>","probImpact":"+3pp"},"suggest":{"text":"测试","action":"OK","alt":"取消"}}' | jq

list:
	@curl -sS http://localhost:8080/api/push | jq
