package server

// originAllowed 报告给定 Origin 头是否在 CORS 白名单内。
//
// 同时被 withCORS（REST preflight）和 handleStream（SSE 握手）调用，
// 保证两处 origin 校验逻辑不会漂移 —— 这是 v2 sonnet review 发现的高优修正点。
//
// 当前为精确匹配（map[origin]bool）。设计上故意不支持正则 / 通配：
//   - 用户决策：不开放 Vercel preview 等动态域名
//   - 实测使用面：3 个本地端口 + 2 个正式域名，列举完整足够
//
// 未来如需加 regex（例如开放 *.oddfi.io），仅在此函数加一段逻辑，调用方不必变。
func (s *Server) originAllowed(origin string) bool {
	if s.origins["*"] {
		return true
	}
	if origin == "" {
		return false
	}
	_, ok := s.origins[origin]
	return ok
}
