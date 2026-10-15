## 详情页 spider 服务

- 支持定时采集 sportmonk api 数据并落库，并通过 oddfi-web-api 服务查询M ySQL 库数据查询

## 前端需要查询的数据表最小字段集合
二、实体字段明细
2.1 Fixture（赛事主体）

字段	类型	状态	使用位置
id	number	✅	路由跳转、下注关联、React key
league_id	number	✅	赛事分组、联赛权重排序、分类过滤
name	string	✅	比赛名展示、下注单存储
starting_at	string	✅	时间展示（日期/时间格式化）、时间线分组（.slice(0,10) 取日期）
starting_at_timestamp	number	✅	同联赛内赛事排序
state_id	number	✅	Live/Upcoming/Finished 分类、进行中场次过滤
has_odds	boolean	✅	精选赛事卡片过滤（无赔率赛事不展示）
participants	array	✅	队名、队徽、主客场判断
odds	array	✅	赔率展示、下注入口
league	object?	✅	联赛名、联赛图标（内嵌，部分场景作为 /leagues 的 fallback）
statistics	array?	✅	详情页统计数据（射正/角球/黄牌/红牌）

无需存储的 Fixture 顶层字段举例：season_id、round_id、venue_id、leg、aggregate、referee_id、periods（periods 前端不用）

---
2.2 Participant（参赛队伍）
每个 Fixture 包含 2 个 Participant（主队 + 客队）。
字段	类型	状态	使用位置
id	number	🔮	暂无直接访问
name	string	✅	队名展示、下注单、搜索过滤
image_path	string	✅	队徽图片 URL
meta.location	"home"|"away"	✅	区分主客队（所有展示组件依赖此字段）
country_id	number	✅	国家赛事分类过滤（useCategoryMap 国家队检测）
type	"domestic"|"national"	✅	国家队赛事检测（世界杯 / 欧洲杯分类）
meta.winner	boolean|null	🔮	赛后胜队高亮（赛果页面未来会用）

---
2.3 OddsEntry（赔率条目）
每个 Fixture 经 filters=bookmakers:2;markets:1,6,7 过滤后，只返回 Bet365 的 3 个盘口数据。
字段	类型	状态	使用位置
id	number	✅	亚盘去重（OddsTable 同 handicap/total 值时排重）
market_id	number	✅	按盘口分组（1=1X2, 6=亚让, 7=亚大小）
label	string	✅	投注按钮文字（"Home"/"Draw"/"Away"/"Over"/"Under"）
value	string	✅	赔率值（小数制，如 "2.10"）
market_description	string	✅	盘口说明标题（"Fulltime Result" 等）
handicap	string|null	✅	亚让球线（"−0.5" 等，前端已归一化分裂盘）
total	string|null	✅	大小球线（"2.5" 等，前端已归一化分裂盘）
winning	boolean	🔮	已结算赢注标记（赛后结算 UI 会需要）
stopped	boolean	🔮	投注暂停标记（赛事中断/临开赛时禁投）
fixture_id	number	✅	关联的 Fixture ID（下注关联）
fixture_name	string	✅	关联的 Fixture 名称（下注关联）

---
2.4统计数据
字段	类型	状态	使用位置
type_id	number	✅	匹配统计类型（见下方 type_id 速查）
location	"home"|"away"	✅	区分主客队统计值
data.value	number	✅	展示数值


## 前端查询需要的场景
1. GET /v3/football/fixtures/date/{YYYY-MM-DD}
使用场景：首页按日期查赛程（今天/昨天/明天的时间线）
2. GET /v3/football/fixtures/between/{start}/{end}
使用场景：首页未来 7 天无限滚动加载
3. GET /v3/football/fixtures/{fixtureId}