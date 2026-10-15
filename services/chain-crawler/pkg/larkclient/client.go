package larkclient

import (
	"chain_crawler/internal/config"
	"chain_crawler/pkg/httpclient"
	"chain_crawler/pkg/timelocker"
	"chain_crawler/pkg/tracelog"
	"context"
	"fmt"
	"os"
	"time"
)

const DefaultLarkHookUrl = "https://open.larksuite.com/open-apis/bot/v2/hook"

type Client interface {
	PostMessageAsync(ctx context.Context, title, msg string)
	PostMessageAsyncByServiceBotID(ctx context.Context, title, msg string)
	NotifyServiceStart(ctx context.Context, serverName, changesLink string) error
	NotifyServiceShutdown(ctx context.Context, serverName, errmsg string) error
}

type NotifyRequest struct {
	Ctx   context.Context
	Title string `json:"title"`
	Msg   string `json:"msg"`
	BotID string `json:"bot_id"`
}

type clientImpl struct {
	env        string
	timeLocker timelocker.Timelocker
	httpClient httpclient.HttpClient
	notifyChan chan *NotifyRequest
	exitChan   chan struct{}
}

func NewClient(env string) Client {
	c := &clientImpl{
		env:        env,
		timeLocker: timelocker.NewTimeLocker(),
		httpClient: httpclient.NewHttpClient(),
		notifyChan: make(chan *NotifyRequest, 32),
		exitChan:   make(chan struct{}),
	}
	go c.background()
	return c
}

func (c *clientImpl) background() {
	for {
		select {
		case req := <-c.notifyChan:
			_ = c.postMessage(req.Ctx, req.Title, req.Msg, req.BotID)
		case <-c.exitChan:
			return
		}
	}
}

func (c *clientImpl) postMessage(ctx context.Context, title, msg, botID string) error {
	postMessageSpanCtx, postMessageSpan := tracelog.StartSpan(ctx, "larkclient", "postMessage")
	defer postMessageSpan.End()
	tl := tracelog.NewWithContext(postMessageSpanCtx)
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	if botID == "" {
		tl.Infow("larkClient postMessage failed", "title", title, "msg", msg, "reason", "botID is empty")
		return nil
	}
	req := &BotHookRequest{
		MsgType: MsgType_Post,
		Content: &Content{
			Post: &Post{
				ZhCn: &RichTextContent{
					Title: fmt.Sprintf("【Env:%+v】%+v", c.env, title),
					Content: []RichTextLine{
						{
							RichTextItemText(msg),
						},
					},
				},
			},
		},
	}

	resp := &BotHookResp{}
	if err := c.httpClient.Post(ctx, fmt.Sprintf("%s/%s", DefaultLarkHookUrl, botID), nil, req, resp); err != nil {
		tl.Errorw("httpclient.Post failed", "error", err.Error())
		return err
	} else if resp.Code != 0 {
		tl.Errorw("httpclient.Post failed", "code", resp.Code, "message", resp.Message)
		return fmt.Errorf("httpclient.Post failed, code: %d, message: %s", resp.Code, resp.Message)
	}
	return nil
}

func (c *clientImpl) tryLockTitle(title string) bool {
	return c.timeLocker.TryLockTime(fmt.Sprintf("larkclient:post-message:%+v", title), 3*time.Minute)
}

func (c *clientImpl) PostMessageAsync(ctx context.Context, title, msg string) {
	postMessageSpanCtx, postMessageSpan := tracelog.StartSpan(ctx, "larkclient", "PostMessageAsync")
	defer postMessageSpan.End()
	tl := tracelog.NewWithContext(postMessageSpanCtx)
	if !c.tryLockTitle(title) {
		tl.Infow("larkClient postMessage failed", "title", title, "msg", msg, "reason", "tryLockTitle failed")
		return
	}
	c.notifyChan <- &NotifyRequest{
		Ctx:   postMessageSpanCtx,
		Title: title,
		Msg:   msg,
		BotID: config.GetDefaultNacosChainCrawlerConfig().Lark.AlertLarkBotId,
	}
}

func (c *clientImpl) PostMessageAsyncByServiceBotID(ctx context.Context, title, msg string) {
	postMessageSpanCtx, postMessageSpan := tracelog.StartSpan(ctx, "larkclient", "PostMessageAsyncByServiceBotID")
	defer postMessageSpan.End()
	tl := tracelog.NewWithContext(postMessageSpanCtx)
	if !c.tryLockTitle(title) {
		tl.Infow("larkClient postMessage failed", "title", title, "msg", msg, "reason", "tryLockTitle failed")
		return
	}
	c.notifyChan <- &NotifyRequest{
		Ctx:   postMessageSpanCtx,
		Title: title,
		Msg:   msg,
		BotID: config.GetDefaultNacosChainCrawlerConfig().Lark.ServiceBotId,
	}
}

func (c *clientImpl) NotifyServiceStart(ctx context.Context, serverName, changesLink string) error {
	notifyServiceStartSpanCtx, notifyServiceStartSpan := tracelog.StartSpan(ctx, "larkclient", "NotifyServiceStart")
	defer notifyServiceStartSpan.End()
	tl := tracelog.NewWithContext(notifyServiceStartSpanCtx)
	hostname, _ := os.Hostname()
	if err := c.postMessage(ctx, fmt.Sprintf("%+v服务上线", serverName), fmt.Sprintf("服务实例 %+v\n代码修改 %+v", hostname, changesLink), config.GetDefaultNacosChainCrawlerConfig().Lark.ServiceBotId); err != nil {
		tl.Errorw("postMessage failed", "error", err.Error())
		return err
	}
	return nil
}

func (c *clientImpl) NotifyServiceShutdown(ctx context.Context, serverName, errmsg string) error {
	notifyServiceShutdownSpanCtx, notifyServiceShutdownSpan := tracelog.StartSpan(ctx, "larkclient", "NotifyServiceShutdown")
	defer notifyServiceShutdownSpan.End()
	tl := tracelog.NewWithContext(notifyServiceShutdownSpanCtx)
	hostname, _ := os.Hostname()
	if err := c.postMessage(ctx, fmt.Sprintf("%+v服务关闭", serverName), fmt.Sprintf("服务实例 %+v\n报错信息 %+v", hostname, errmsg), config.GetDefaultNacosChainCrawlerConfig().Lark.ServiceBotId); err != nil {
		tl.Errorw("postMessage failed", "error", err.Error())
		return err
	}
	return nil
}
