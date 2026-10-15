package tweetcatcher

import "encoding/json"

// Op codes for Tweet Catcher WS protocol
const (
	OpDispatch  = 0  // server → client: event
	OpHeartbeat = 1  // client → server
	OpIdentify  = 2  // client → server: login
	OpHello     = 10 // server → client: contains heartbeat_interval
	OpAck       = 11 // server → client: heartbeat ack
)

// Envelope 是 WS 帧的通用外层
type Envelope struct {
	Op int             `json:"op"`
	D  json.RawMessage `json:"d,omitempty"`
}

type Hello struct {
	HeartbeatInterval int `json:"heartbeat_interval"`
}

// DispatchEvent 是 op=0 的 d 字段内容
type DispatchEvent struct {
	EventID  string          `json:"event_id"`
	Event    string          `json:"event"` // twitter.post.new / twitter.post.deleted / etc
	TaskInfo TaskInfo        `json:"task_info"`
	Data     json.RawMessage `json:"data"`
}

type TaskInfo struct {
	ID          int      `json:"id"`
	Group       string   `json:"group,omitempty"`
	Handle      string   `json:"handle"`
	ProfileInfo UserInfo `json:"profile_info"`
}

type UserInfo struct {
	ID           string             `json:"id"`
	CreatedAt    int64              `json:"created_at,omitempty"`
	Handle       string             `json:"handle"`
	Name         string             `json:"name"`
	Avatar       string             `json:"avatar,omitempty"`
	Banner       string             `json:"banner,omitempty"`
	Description  string             `json:"description,omitempty"`
	Location     string             `json:"location,omitempty"`
	Website      string             `json:"website,omitempty"`
	Verification *Verification      `json:"verification,omitempty"`
	Stats        *UserStats         `json:"stats,omitempty"`
}

type Verification struct {
	IsVerified bool   `json:"is_verified"`
	Type       string `json:"type,omitempty"`
}

type UserStats struct {
	Followers int `json:"followers"`
	Following int `json:"following"`
	Posts     int `json:"posts"`
	Media     int `json:"media"`
	Likes     int `json:"likes"`
}

type Media struct {
	Type     string `json:"type"`
	URL      string `json:"url"`
	Preview  string `json:"preview,omitempty"`
	Duration int    `json:"duration,omitempty"`
}

type Mention struct {
	ID     string `json:"id,omitempty"`
	Handle string `json:"handle,omitempty"`
}

// PostData 是 tweet 主体
type PostData struct {
	ID        string    `json:"id"`
	CreatedAt int64     `json:"created_at"`
	Type      string    `json:"type"` // post | repost | quote | reply
	Text      string    `json:"text"`
	Media     []Media   `json:"media,omitempty"`
	Mentions  []Mention `json:"mentions,omitempty"`
	Tags      []string  `json:"tags,omitempty"`
	Author    UserInfo  `json:"author"`
	Quoted    *PostData `json:"quoted,omitempty"`
	Reposted  *PostData `json:"reposted,omitempty"`
	Replied   *PostData `json:"replied,omitempty"`
}

// UnmarshalPost 仅在 event 是 post 类型时返回 PostData，否则返回 nil
func (e *DispatchEvent) UnmarshalPost() (*PostData, error) {
	switch e.Event {
	case "twitter.post.new", "truth_social.post.new":
		var p PostData
		if err := json.Unmarshal(e.Data, &p); err != nil {
			return nil, err
		}
		return &p, nil
	default:
		return nil, nil
	}
}
