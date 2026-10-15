package handler

// func GetMarketFixtureByDate(c *gin.Context) {
// 	dateStr := c.Param("date")
// 	if dateStr == "" {
// 		c.JSON(http.StatusBadRequest, model.Response{
// 			Code: 400,
// 			Msg:  "dateStr 参数缺少",
// 			Data: nil,
// 		})
// 		return
// 	}

// 	//校验 date 格式是否为 YYYY-MM-DD
// 	if !isValidDate(dateStr) {
// 		c.JSON(http.StatusBadRequest, model.Response{
// 			Code: 400,
// 			Msg:  "dateStr 格式错误，应为 YYYY-MM-DD",
// 			Data: nil,
// 		})
// 		return
// 	}

// 	//传参是一个date 日期字符串，格式为 YYYY-MM-DD
// 	//需要优先从缓存中查找是否有该日期的 fixture
// 	// "starting_at": "2026-04-07 19:00:00",

// 	// 2. 将需要查询的缓存 Key 整理成列表，按优先级排序
// 	cacheKeys := []string{
// 		FormatCacheKey(WorldCupLeagueID),
// 		FormatCacheKey(EuroLeagueID),
// 	}

// 	// 3. 遍历缓存进行检索
// 	for i, cacheKey := range cacheKeys {
// 		if cachedData, ok := getCachedData(cacheKey); ok {
// 			// 在当前缓存中过滤指定 ID
// 			result := filterByDate(cachedData, dateStr)

// 			if len(result) > 0 {
// 				// 找到了！直接返回，中断后续操作
// 				log.Infof("[GetMarketFixtureByDate] get succ from cache index %d, cache_key: %s", i, cacheKey)
// 				c.JSON(http.StatusOK, model.Response{
// 					Code: 200,
// 					Msg:  "success",
// 					Data: result,
// 				})
// 				return
// 			}
// 		}
// 	}

// 	// 4. 走到这里说明：要么缓存全空，要么缓存里都没找到对应的 fixIDInt -> 降级走源 API 请求
// 	log.Infof("[GetMarketFixtureByDate] cache missed, fetch sportmonks data, date: %s", dateStr)
// 	fixtures, err := fetchSportMonksDataByDate(c.Request.Context(), dateStr)
// 	if err != nil {
// 		log.Errorf("[⚠️⚠️⚠️][GetMarketFixtureByDate] fetch sportmonks data failed: %v", err)
// 		c.JSON(http.StatusInternalServerError, model.Response{
// 			Code: 500,
// 			Msg:  "拉取 " + dateStr + " 数据失败",
// 			Data: nil,
// 		})
// 		return
// 	}

// 	log.Infof("[GetMarketFixtureByDate] get succ from sportmonks, date: %s, len: %d", dateStr, len(fixtures))

// 	// 5. 兜底返回 API 拿到的数据
// 	c.JSON(http.StatusOK, model.Response{
// 		Code: 200,
// 		Msg:  "success",
// 		Data: fixtures,
// 	})
// }

// func GetMarketFixture(c *gin.Context) {
// 	fixIDStr := c.Param("fixture_id")
// 	if fixIDStr == "" {
// 		c.JSON(http.StatusBadRequest, model.Response{
// 			Code: 400,
// 			Msg:  "fixture_id 参数缺少",
// 			Data: nil,
// 		})
// 		return
// 	}

// 	// 1. 严格校验转码错误，防止异常输入
// 	fixIDInt, err := strconv.Atoi(fixIDStr)
// 	if err != nil {
// 		c.JSON(http.StatusBadRequest, model.Response{
// 			Code: 400,
// 			Msg:  "fixture_id 参数格式错误，必须为数字",
// 			Data: nil,
// 		})
// 		return
// 	}

// 	//再校验一个参数 type
// 	typeParam := c.DefaultQuery("type", "")
// 	if typeParam == "" {
// 		//直接报错
// 		c.JSON(http.StatusBadRequest, model.Response{
// 			Code: 400,
// 			Msg:  "type 参数缺少",
// 			Data: nil,
// 		})
// 		return
// 	}
// 	if typeParam == "statis" {
// 		//比赛详情页（include=participants;odds;league;statistics）
// 		typeParam = "participants;odds;league;statistics"
// 	} else {
// 		//卡片预览（include=participants;odds;league）
// 		typeParam = "participants;odds;league"
// 	}

// 	// 2. 将需要查询的缓存 Key 整理成列表，按优先级排序
// 	cacheKeys := []string{
// 		FormatCacheKey(WorldCupLeagueID),
// 		FormatCacheKey(EuroLeagueID),
// 	}

// 	// 如果 typeParam == statis，只过滤掉 fixtures.Statistic 里面 type_id ∈ {34, 41, 84, 85} 的数据
// 	// 如果 typeParam == 其他，不返回 fixtures.Statistic 数据

// 	// 3. 遍历缓存进行检索
// 	for i, cacheKey := range cacheKeys {
// 		if cachedData, ok := getCachedData(cacheKey); ok {
// 			// 在当前缓存中过滤指定 ID
// 			result := filterByFixID(cachedData, fixIDInt, typeParam == "statis")

// 			if len(result) > 0 {
// 				// 找到了！直接返回，中断后续操作
// 				log.Infof("[GetMarketFixture] get succ from cache index %d, cache_key: %s", i, cacheKey)
// 				c.JSON(http.StatusOK, model.Response{
// 					Code: 200,
// 					Msg:  "success",
// 					Data: result,
// 				})
// 				return
// 			}
// 		}
// 	}

// 	// 4. 走到这里说明：要么缓存全空，要么缓存里都没找到对应的 fixIDInt -> 降级走源 API 请求
// 	log.Infof("[GetMarketFixture] cache missed, fetch sportmonks data, fixture_id: %s", fixIDStr)
// 	fixtures, err := fetchSportMonksDataByFixID(c.Request.Context(), fixIDStr, typeParam)
// 	if err != nil {
// 		log.Errorf("[⚠️⚠️⚠️][GetMarketFixture] fetch sportmonks data failed: %v", err)
// 		c.JSON(http.StatusInternalServerError, model.Response{
// 			Code: 500,
// 			Msg:  "拉取 " + fixIDStr + " 数据失败",
// 			Data: nil,
// 		})
// 		return
// 	}

// 	log.Infof("[GetMarketFixture] get succ from sportmonks, fixture_id: %s, len: %d", fixIDStr, len(fixtures))

// 	// 5. 兜底返回 API 拿到的数据
// 	c.JSON(http.StatusOK, model.Response{
// 		Code: 200,
// 		Msg:  "success",
// 		Data: fixtures,
// 	})
// }

// mock 代码注释调
// func GetMarketFixture(c *gin.Context) {
// 	fixIDStr := c.Param("fixture_id")
// 	if fixIDStr == "" {
// 		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "fixture_id 参数缺少"})
// 		return
// 	}
// 	// 1. 严格校验转码错误，防止异常输入
// 	fixIDInt, err := strconv.Atoi(fixIDStr)
// 	if err != nil {
// 		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "fixture_id 参数格式错误，必须为数字"})
// 		return
// 	}

// 	// 2. 校验 type 参数并确定是否需要统计数据
// 	typeParam := c.DefaultQuery("type", "")
// 	if typeParam == "" {
// 		c.JSON(http.StatusBadRequest, model.Response{Code: 400, Msg: "type 参数缺少"})
// 		return
// 	}

// 	isStatis := typeParam == "statis"
// 	includeParam := "participants;odds;league"
// 	if isStatis {
// 		includeParam += ";statistics"
// 	}

// 	// 3. 遍历缓存进行检索
// 	cacheKeys := []string{
// 		FormatCacheKey(WorldCupLeagueID),
// 		FormatCacheKey(EuroLeagueID),
// 	}

// 	for i, cacheKey := range cacheKeys {
// 		if cachedData, ok := getCachedData(cacheKey); ok {
// 			// 从缓存中查找并安全过滤
// 			if result, found := getAndFilterFromCache(cachedData, fixIDInt, isStatis); found {
// 				log.Infof("[GetMarketFixture] get succ from cache index %d, cache_key: %s", i, cacheKey)
// 				c.JSON(http.StatusOK, model.Response{Code: 200, Msg: "success", Data: result})
// 				return
// 			}
// 		}
// 	}

// 	// 4. 降级走源 API 请求
// 	log.Infof("[GetMarketFixture] cache missed, fetch sportmonks data, fixture_id: %s", fixIDStr)
// 	fixtures, err := fetchSportMonksDataByFixID(c.Request.Context(), fixIDStr, includeParam)
// 	if err != nil {
// 		log.Errorf("[⚠️⚠️⚠️][GetMarketFixture] fetch sportmonks data failed: %v", err)
// 		c.JSON(http.StatusInternalServerError, model.Response{Code: 500, Msg: "拉取 " + fixIDStr + " 数据失败"})
// 		return
// 	}

// 	// 5. 对源 API 取回来的新数据应用同样的过滤规则（保持数据结构一致性）
// 	filterFixturesStats(fixtures, isStatis)

// 	log.Infof("[GetMarketFixture] get succ from sportmonks, fixture_id: %s, len: %d", fixIDStr, len(fixtures))
// 	c.JSON(http.StatusOK, model.Response{Code: 200, Msg: "success", Data: fixtures})
// }

// // GetBatchTokenPrices 批量获取价格
// func (s *PriceService) GetBatchTokenPrices(ctx context.Context, tokens []TokenIdentifier) ([]TokenPriceData, error) {
// 	// 1. 按 Network (链) 分组
// 	var finalResults []TokenPriceData
// 	missingTokens := make([]TokenIdentifier, 0)
// 	networkToAddresses := make(map[string][]string)

// 	// 1. 第一层：Redis 批量查询 (MGET)
// 	keys := make([]string, len(tokens))
// 	for i, t := range tokens {
// 		keys[i] = fmt.Sprintf("price:%s:%s", t.ChainID, strings.ToLower(t.Address))
// 	}

// 	cachedValues, err := s.rdb.MGet(ctx, keys...)
// 	if err == nil {
// 		for i, val := range cachedValues {
// 			if val != nil {
// 				// 命中缓存，直接解析
// 				var item TokenPriceData
// 				if json.Unmarshal([]byte(val.(string)), &item) == nil {
// 					finalResults = append(finalResults, item)
// 					continue
// 				}
// 			}
// 			// 未命中或解析失败，加入待抓取列表
// 			missingTokens = append(missingTokens, tokens[i])
// 		}
// 	} else {
// 		missingTokens = tokens // Redis 异常，全量抓取兜底
// 	}

// 	if len(missingTokens) == 0 {
// 		log.Infof("[GetBatchTokenPrices] 🍃🍃🍃 all tokens hit cache, len: %d", len(finalResults))
// 		// 所有 token 都命中缓存，直接返回
// 		return finalResults, nil
// 	}

// 	for _, t := range tokens {
// 		if !lo.Contains(evmChains, t.ChainID) {
// 			log.Errorf("[GetBatchTokenPrices] unsupported chain_id: %s", t.ChainID)
// 			continue
// 		}
// 		network := t.ChainID
// 		// 地址统一转小写以防匹配失败 (Solana 除外，Gecko 内部会处理)
// 		addr := strings.ToLower(t.Address)
// 		networkToAddresses[network] = append(networkToAddresses[network], addr)
// 	}

// 	// 2. 第二层：按链分组并限流抓取
// 	networkGroups := make(map[string][]string)
// 	for _, t := range missingTokens {
// 		if lo.Contains(evmChains, t.ChainID) {
// 			networkGroups[t.ChainID] = append(networkGroups[t.ChainID], strings.ToLower(t.Address))
// 		}
// 	}

// 	var wg sync.WaitGroup
// 	var mu sync.Mutex
// 	var results []TokenPriceData
// 	var fetchErrs []error

// 	// 2. 遍历每个链，处理批量逻辑
// 	for network, addresses := range networkGroups {
// 		// GeckoTerminal 限制每次最多 30 个地址
// 		chunkSize := 30
// 		for i := 0; i < len(addresses); i += chunkSize {
// 			end := i + chunkSize
// 			if end > len(addresses) {
// 				end = len(addresses)
// 			}
// 			chunk := addresses[i:end]

// 			wg.Add(1)
// 			// 3. 并发发起请求
// 			go func(net string, addrs []string) {
// 				defer wg.Done()

// 				// 拼接地址，逗号分隔
// 				addrStr := strings.Join(addrs, ",")
// 				path := fmt.Sprintf("networks/%s/tokens/multi/%s", net, addrStr)

// 				var res GeckoMultiTokenResponse
// 				if err := s.geckoClient.GetTokenPrice(ctx, path, url.Values{}, &res); err != nil {
// 					log.Errorf("[GetBatchTokenPrices] failed fetching %s: %v", net, err)
// 					fetchErrs = append(fetchErrs, fmt.Errorf("failed fetching %s: %v", net, err))
// 					return
// 				}
// 				// 3. 第三层：回填 Redis 并聚合结果
// 				pipe := s.rdb.Pipeline()
// 				mu.Lock()

// 				// 解析并组装结果
// 				for _, item := range res.Data {
// 					retAddr := strings.ToLower(item.Attributes.Address)
// 					// mapKey := fmt.Sprintf("%s_%s", net, retAddr)
// 					item := TokenPriceData{
// 						ChainID:       net,
// 						Address:       retAddr,
// 						Price:         item.Attributes.PriceUSD,
// 						Symbol:        item.Attributes.Symbol,
// 						ImageURL:      item.Attributes.ImageURL,
// 						ChainImageURL: chainToGeckoImageURL[network],
// 					}
// 					results = append(results, item)
// 					// 写入缓存 设置过期时间为 1 小时
// 					pipe.Set(ctx, fmt.Sprintf("price:%s:%s", net, retAddr), item, 10*time.Minute)
// 				}
// 				mu.Unlock()
// 				_, _ = pipe.Exec(ctx) // 批量写入 Redis
// 			}(network, chunk)
// 		}
// 	}
// 	wg.Wait()
// 	// 可选：如果你希望部分失败时依然返回成功的部分，这里可以只 log err
// 	if len(fetchErrs) > 0 {
// 		log.Errorf("[GetBatchTokenPrices] Bulk fetch had errors: %v", fetchErrs)
// 	}
// 	log.Infof("[GetBatchTokenPrices] get succ from gecko, len: %d", len(results))
// 	return results, nil
// }

// ===================== 接口1：获取2026所有比赛 =====================
// GET /v1/detail/sports_all?live=true/false
// func GetSportsAll(c *gin.Context) {
// 	// 1. 解析查询参数：live筛选
// 	liveParam := c.DefaultQuery("type", "")
// 	isLive := false
// 	if liveParam == "live" {
// 		isLive = true
// 	}
// 	leagueParm := c.DefaultQuery("league", "")
// 	if leagueParm == "" {
// 		leagueParm = WorldCupLeagueID
// 	}

// 	page := c.DefaultQuery("page", "1")
// 	if page == "" {
// 		//返回报错 这个字段必须校验
// 		c.JSON(http.StatusBadRequest, model.Response{
// 			Code: 400,
// 			Msg:  "page 参数缺少",
// 			Data: nil,
// 		})
// 		return
// 	}
// 	pageNum, _ := strconv.Atoi(page)
// 	//TODO 如果leagueParm 为空，默认取其他赛事

// 	var fetchLeague string
// 	var cacheKey string
// 	if leagueParm == "732" {
// 		// 2026世界杯固定联赛
// 		fetchLeague = WorldCupLeagueID
// 		cacheKey = FormatCacheKey(fetchLeague)
// 	} else if leagueParm == "2" {
// 		// 欧冠联赛
// 		fetchLeague = EuroLeagueID
// 		cacheKey = FormatCacheKey(fetchLeague)
// 	}

// 	// 2. 读缓存，无缓存则拉取SportMonks
// 	var fixtures []model.Fixture
// 	var err error
// 	data, ok := getCachedData(cacheKey)
// 	if ok {
// 		fixtures = data
// 		//这里按需page 返回第几页的缓存 每一页固定 25 条数据
// 		// 假设 pageSize 是固定的 25
// 		pageSize := 25
// 		total := len(fixtures)
// 		// 1. 容错处理：确保 pageNum 是合法的正整数
// 		if pageNum < 1 {
// 			pageNum = 1
// 		}
// 		// 2. 计算起始索引
// 		start := (pageNum - 1) * pageSize
// 		// 3. 越界检查：如果起始索引已经超出了总数据量，说明请求的页码过大，直接返回空切片
// 		if start >= total {
// 			// 假设切片类型是 []Fixture，这里根据实际类型返回 nil 或空切片
// 			fixtures = fixtures[:0] // 这样写可以保留原切片的类型，或者直接 return nil
// 		} else {
// 			// 4. 计算结束索引，并处理最后一页不足 25 条的情况
// 			end := start + pageSize
// 			if end > total {
// 				end = total
// 			}
// 			// 5. 安全截取并返回
// 			fixtures = fixtures[start:end]
// 		}
// 		log.Infof("[GetSportsAll] get succ from cache")
// 	} else {
// 		fixtures, err = fetchSportMonksData(c.Request.Context(), fetchLeague, page)
// 		if err != nil {
// 			log.Errorf("[⚠️⚠️⚠️][GetSportsAll] fetch sportmonks data failed: %v", err)
// 			c.JSON(http.StatusInternalServerError, model.Response{
// 				Code: 500,
// 				Msg:  "拉取世界杯数据失败",
// 				Data: nil,
// 			})
// 			return
// 		}
// 		log.Infof("[GetSportsAll] get succ from sportmonks")
// 		// setCachedData(cacheKey, fixtures)
// 		if fetchLeague == WorldCupLeagueID {
// 			go UpdateAllWorldCupFixtures(restClient, c.Request.Context())
// 		} else if fetchLeague == EuroLeagueID {
// 			go UpdateAllEuFixtures(restClient, c.Request.Context())
// 		}
// 	}

// 	// 3. 按live过滤
// 	result := fixtures
// 	if liveParam != "" {
// 		result = filterByLive(result, isLive)
// 	}

// 	// 4. 返回数据
// 	c.JSON(http.StatusOK, model.Response{
// 		Code: 200,
// 		Msg:  "success",
// 		Data: result,
// 	})
// }

// GET /v1/detail/stage_all/:stage_id?live=true/false
// func GetStageByID(c *gin.Context) {
// 	// 1. 解析路径参数：stage_id
// 	stageIDStr := c.Param("stage_id")
// 	stageID, err := strconv.Atoi(stageIDStr)
// 	if err != nil {
// 		c.JSON(http.StatusBadRequest, model.Response{
// 			Code: 400,
// 			Msg:  "stage_id 参数非法",
// 			Data: nil,
// 		})
// 		return
// 	}

// 	// 2. 解析live参数
// 	liveParam := c.DefaultQuery("live", "")
// 	isLive := false
// 	if liveParam == "live" {
// 		isLive = true
// 	}

// 	leagueParm := c.DefaultQuery("league", "")
// 	if leagueParm == "" {
// 		leagueParm = WorldCupLeagueID
// 	}
// 	var cacheKey string
// 	if leagueParm == "732" {
// 		// 2026世界杯固定联赛
// 		cacheKey = FormatCacheKey(WorldCupLeagueID)
// 	} else if leagueParm == "2" {
// 		// 欧冠联赛
// 		cacheKey = FormatCacheKey(EuroLeagueID)
// 	}

// 	// 3. 读缓存/拉取数据
// 	var fixtures []model.Fixture
// 	data, ok := getCachedData(cacheKey)
// 	if ok {
// 		fixtures = data
// 		log.Infof("[GetStageByID] get succ from cache")
// 	} else {
// 		fixtures, err = fetchSportMonksDataByStageID(c.Request.Context(), stageIDStr)
// 		if err != nil {
// 			log.Errorf("[⚠️⚠️⚠️][GetStageByID] fetch sportmonks data failed: %v", err)
// 			c.JSON(http.StatusInternalServerError, model.Response{
// 				Code: 500,
// 				Msg:  "拉取" + leagueParm + "数据失败",
// 				Data: nil,
// 			})
// 			return
// 		}
// 		log.Infof("[GetStageByID] get succ from sportmonks")
// 	}

// 	// 4. 双重过滤：stage_id + live
// 	result := filterByStageID(fixtures, stageID)
// 	if liveParam != "" {
// 		result = filterByLive(result, isLive)
// 	}

// 	// 5. 返回
// 	c.JSON(http.StatusOK, model.Response{
// 		Code: 200,
// 		Msg:  "success",
// 		Data: result,
// 	})
// }

// // GetMarketFixtureByBetween
// func GetMarketFixtureByBetween(c *gin.Context) {
// 	// 1. 解析路径参数：start_date 和 end_date
// 	startDateStr := c.Param("start_date")
// 	endDateStr := c.Param("end_date")

// 	// 2. 校验日期格式
// 	if !isValidDate(startDateStr) || !isValidDate(endDateStr) {
// 		c.JSON(http.StatusBadRequest, model.Response{
// 			Code: 400,
// 			Msg:  "日期格式错误，正确格式为 YYYY-MM-DD",
// 			Data: nil,
// 		})
// 		return
// 	}
// 	// 2. 将需要查询的缓存 Key 整理成列表，按优先级排序
// 	cacheKeys := []string{
// 		FormatCacheKey(WorldCupLeagueID),
// 		FormatCacheKey(EuroLeagueID),
// 	}

// 	// 3. 遍历缓存进行检索
// 	for i, cacheKey := range cacheKeys {
// 		if cachedData, ok := getCachedData(cacheKey); ok {
// 			// 在当前缓存中过滤指定 ID
// 			result := filterByDateBetween(cachedData, startDateStr, endDateStr)

// 			if len(result) > 0 {
// 				// 找到了！直接返回，中断后续操作
// 				log.Infof("[GetMarketFixtureByBetween] get succ from cache index %d, cache_key: %s", i, cacheKey)
// 				c.JSON(http.StatusOK, model.Response{
// 					Code: 200,
// 					Msg:  "success",
// 					Data: result,
// 				})
// 				return
// 			}
// 		}
// 	}

// 	// 4. 走到这里说明：要么缓存全空，要么缓存里都没找到对应的 fixIDInt -> 降级走源 API 请求
// 	log.Infof("[GetMarketFixtureByBetween] cache missed, fetch sportmonks data, start_date: %s 到 end_date: %s", startDateStr, endDateStr)
// 	fixtures, err := fetchSportMonksDataByDateBetween(c.Request.Context(), startDateStr, endDateStr)
// 	if err != nil {
// 		log.Errorf("[⚠️⚠️⚠️][GetMarketFixtureByDate] fetch sportmonks data failed: %v", err)
// 		c.JSON(http.StatusInternalServerError, model.Response{
// 			Code: 500,
// 			Msg:  "拉取 " + startDateStr + " 到 " + endDateStr + " 数据失败",
// 			Data: nil,
// 		})
// 		return
// 	}

// 	log.Infof("[GetMarketFixtureByBetween] get succ from sportmonks, start_date: %s 到 end_date: %s, len: %d", startDateStr, endDateStr, len(fixtures))

// 	// 5. 兜底返回 API 拿到的数据
// 	c.JSON(http.StatusOK, model.Response{
// 		Code: 200,
// 		Msg:  "success",
// 		Data: fixtures,
// 	})
// }

// func UpdateAllWorldCupFixtures(client *client.RestClient, ctx context.Context) {
// 	fixtures, err := fetchSportMonksDataAll(ctx, WorldCupLeagueID)
// 	if err != nil {
// 		log.Errorf("[⚠️⚠️⚠️][UpdateAllWorldCupFixtures] fetch sportmonks data failed: %v", err)
// 	}
// 	log.Infof("[UpdateAllWorldCupFixtures] get WorldCupLeagueID  succ from sportmonks")
// 	cacheKey := FormatCacheKey(WorldCupLeagueID)
// 	setCachedData(cacheKey, fixtures)
// }

// func UpdateAllEuFixtures(client *client.RestClient, ctx context.Context) {
// 	fixtures, err := fetchSportMonksDataAll(ctx, EuroLeagueID)
// 	if err != nil {
// 		log.Errorf("[⚠️⚠️⚠️][UpdateAllEuFixtures] fetch sportmonks data failed: %v", err)
// 	}
// 	log.Infof("[UpdateAllEuFixtures] get EuroLeagueID succ from sportmonks")
// 	cacheKey := FormatCacheKey(EuroLeagueID)
// 	setCachedData(cacheKey, fixtures)
// }

// func UpdateAllFixtures(client *client.RestClient, ctx context.Context) {
// 	// 定期更新所有联赛的 fixture
// 	eg := errgroup.Group{}
// 	// 更新 WorldCupLeagueID
// 	eg.Go(func() error {
// 		fixtures, err := fetchSportMonksDataAll(ctx, WorldCupLeagueID)
// 		if err != nil {
// 			log.Errorf("[⚠️⚠️⚠️][UpdateAllFixtures] fetch sportmonks data failed: %v", err)
// 			return err
// 		}
// 		log.Infof("[UpdateAllFixtures] get WorldCupLeagueID  succ from sportmonks")
// 		cacheKey := FormatCacheKey(WorldCupLeagueID)
// 		setCachedData(cacheKey, fixtures)
// 		return nil
// 	})
// 	// 更新 EuroLeagueID
// 	eg.Go(func() error {
// 		fixtures, err := fetchSportMonksDataAll(ctx, EuroLeagueID)
// 		if err != nil {
// 			log.Errorf("[⚠️⚠️⚠️][UpdateAllFixtures] fetch sportmonks data failed: %v", err)
// 			return err
// 		}
// 		log.Infof("[UpdateAllFixtures] get EuroLeagueID succ from sportmonks")
// 		cacheKey := FormatCacheKey(EuroLeagueID)
// 		setCachedData(cacheKey, fixtures)
// 		return nil
// 	})
// 	// 等待所有任务完成
// 	if err := eg.Wait(); err != nil {
// 		log.Errorf("[⚠️⚠️⚠️][UpdateAllFixtures] update all fixtures failed: %v", err)
// 	}
// 	log.Infof("[🔥][🔥][🔥][UpdateAllFixtures] update all fixtures succ")
// }

// func FormatCacheKey(leagueID string) string {
// 	return fmt.Sprintf("%s_%s", cacheKeyPrefix, leagueID)
// }

// // LoadMockDataToCache 在 main.go 启动时调用
// func LoadMockOddsDataToCache(ctx context.Context) error {
// 	filePath := "config/odds_wc_mock.json"
// 	data, err := os.ReadFile(filePath)
// 	if err != nil {
// 		return fmt.Errorf("读取 Mock 文件失败: %w", err)
// 	}

// 	var matches []model.OddsAPIData
// 	if err := json.Unmarshal(data, &matches); err != nil {
// 		return fmt.Errorf("解析 Mock JSON 失败: %w", err)
// 	}

// 	for _, item := range matches {
// 		homeZh := utils.GlobalMapping[item.HomeTeam]
// 		if homeZh == "" {
// 			homeZh = item.HomeTeam
// 		}
// 		awayZh := utils.GlobalMapping[item.AwayTeam]
// 		if awayZh == "" {
// 			awayZh = item.AwayTeam
// 		}

// 		// 2. 生成 Cache Key (主队+客队)
// 		cacheKey := homeZh + "_" + awayZh
// 		SetOddsMockCachedData(cacheKey, &item)
// 	}

// 	fmt.Printf("✅ Mock 数据加载完成: 共缓存 %d 场赛事\n", len(matches))
// 	return nil
// }

// {
// 	// 开启 mock 模式
// 	// // mock 数据模式，正式版本需要删掉这段逻辑，从 MySQL中读取数据
// 	if cfg.App.MockEnable {
// 		fmt.Printf("Mock mode enabled, loading mock data...\n")
// 		handler.LoadMockOddsDataToCache(ctx)
// 	} else {
// 		// 立即执行一次
// 		handler.UpdateOddsFromAPI(restClient, ctx)
// 		go func() {
// 			ticker := time.NewTicker(2 * time.Hour)
// 			defer ticker.Stop()
// 			for {
// 				select {
// 				case <-ticker.C:
// 					handler.UpdateOddsFromAPI(restClient, ctx)
// 				case <-ctx.Done():
// 					log.Println("Context canceled, odds updater stopping")
// 					return
// 				}
// 			}
// 		}()
// 	}
// }

// mock 数据模式，正式版本需要删掉这段逻辑，从 MySQL中读取数据
// go func() {
// 	handler.UpdateAllFixtures(restClient, ctx)
// 	ticker := time.NewTicker(1 * time.Hour)
// 	defer ticker.Stop()
// 	for {
// 		select {
// 		case <-ticker.C:
// 			handler.UpdateAllFixtures(restClient, ctx)
// 		case <-ctx.Done():
// 			log.Println("Context canceled, server is shutting down")
// 		}
// 	}
// }()
