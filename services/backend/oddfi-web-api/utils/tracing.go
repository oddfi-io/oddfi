package utils

import (
	"io"

	"github.com/opentracing/opentracing-go"
	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/config"
)

var globalTracer, tracerCloser = initTracer()
var GlobalMapping = map[string]string{
	"Algeria":              "阿尔及利亚",
	"Argentina":            "阿根廷",
	"Australia":            "澳大利亚",
	"Austria":              "奥地利",
	"Belgium":              "比利时",
	"Bosnia & Herzegovina": "波斯尼亚和黑塞哥维那",
	"Brazil":               "巴西",
	"Canada":               "加拿大",
	"Cape Verde":           "佛得角",
	"Colombia":             "哥伦比亚",
	"Croatia":              "克罗地亚",
	"Curaçao":              "库拉索",
	"Czech Republic":       "捷克共和国",
	"DR Congo":             "刚果（金）",
	"Ecuador":              "厄瓜多尔",
	"Egypt":                "埃及",
	"England":              "英格兰",
	"France":               "法国",
	"Germany":              "德国",
	"Ghana":                "加纳",
	"Haiti":                "海地",
	"Iran":                 "伊朗",
	"Iraq":                 "伊拉克",
	"Ivory Coast":          "科特迪瓦",
	"Japan":                "日本",
	"Jordan":               "约旦",
	"Mexico":               "墨西哥",
	"Morocco":              "摩洛哥",
	"Netherlands":          "荷兰",
	"New Zealand":          "新西兰",
	"Norway":               "挪威",
	"Panama":               "巴拿马",
	"Paraguay":             "巴拉圭",
	"Portugal":             "葡萄牙",
	"Qatar":                "卡塔尔",
	"Saudi Arabia":         "沙特阿拉伯",
	"Scotland":             "苏格兰",
	"Senegal":              "塞内加尔",
	"South Africa":         "南非",
	"South Korea":          "韩国队",
	"Spain":                "西班牙",
	"Sweden":               "瑞典",
	"Switzerland":          "瑞士",
	"Tunisia":              "突尼斯",
	"Turkey":               "土耳其",
	"Uruguay":              "乌拉圭",
	"USA":                  "美国",
	"Uzbekistan":           "乌兹别克斯坦",
}

func init() {
	opentracing.SetGlobalTracer(globalTracer)
}

func initTracer() (opentracing.Tracer, io.Closer) {
	tracerConfig, err := config.FromEnv()
	if err != nil {
		panic(err)
	}
	tracerConfig.ServiceName = "oddfi-web-api"
	tracerConfig.Sampler = &config.SamplerConfig{
		Type:  "const",
		Param: 1,
	}
	tracer, closer, err := tracerConfig.NewTracer(config.Logger(jaeger.StdLogger))
	if err != nil {
		panic(err)
	}

	return tracer, closer
}

func CloseTracer() {
	err := tracerCloser.Close()
	if err != nil {
		panic(err)
	}
}
