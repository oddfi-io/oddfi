package larkclient

/*
  lark openapi 技术文档见： https://open.larksuite.com/document/client-docs/bot-v3/use-custom-bots-in-a-group
*/

type BotHookResp struct {
	Code    int    `json:"code"`
	Message string `json:"msg"`
	// Data    map[string]any `json:"data"` // 目前用不到该字段
}

type BotHookRequest struct {
	Timestamp string   `json:"timestamp,omitempty"`
	Sign      string   `json:"sign,omitempty"`
	MsgType   MsgType  `json:"msg_type"`
	Content   *Content `json:"content"`
}

type MsgType string

const (
	MsgType_Text      MsgType = "text"
	MsgType_Post      MsgType = "post"
	MsgType_ShareChat MsgType = "share_chat"
	MsgType_Image     MsgType = "image"
)

type Content struct {
	Text        string `json:"text,omitempty"` // omitempty means this field can be omitted if empty
	Post        *Post  `json:"post,omitempty"`
	ShareChatID string `json:"share_chat_id,omitempty"`
	ImageKey    string `json:"image_key,omitempty"`
}

type Post struct {
	ZhCn *RichTextContent `json:"zh_cn,omitempty"`
	// EnUs *RichTextContent `json:"en_us,omitempty"` // 目前仅考虑支持中文
}

type RichTextContent struct {
	Title   string         `json:"title"`
	Content []RichTextLine `json:"content"`
}

type RichTextLine []*RichTextItem

type RichTextItem struct {
	Tag    RichTextItemTag `json:"tag"`
	Text   string          `json:"text,omitempty"`
	Href   string          `json:"href,omitempty"`
	UserID string          `json:"user_id,omitempty"`
}

type RichTextItemTag string

const (
	RichTextItemTag_Text RichTextItemTag = "text"
	RichTextItemTag_At   RichTextItemTag = "at"
	RichTextItemTag_Href RichTextItemTag = "a"
)

func RichTextItemText(text string) *RichTextItem {
	return &RichTextItem{
		Tag:  RichTextItemTag_Text,
		Text: text,
	}
}

func RichTextItemAt(userID string) *RichTextItem {
	return &RichTextItem{
		Tag:    RichTextItemTag_At,
		UserID: userID,
	}
}

func RichTextItemHref(text string, href string) *RichTextItem {
	return &RichTextItem{
		Tag:  RichTextItemTag_Href,
		Text: text,
		Href: href,
	}
}
