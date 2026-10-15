package auth

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"chain_crawler/internal/pkg/types"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/utils"

	"github.com/gin-gonic/gin"
)

const (
	SignVersionV1 = "web3_v1"
	SignVersionV2 = "web3_v2"
)

var v1SignHeaders = []string{
	types.HeaderAppKey,
	types.HeaderRandom,
	types.HeaderTime,
	types.HeaderAppLang,
	types.HeaderVersion,
	types.HeaderBuild,
	types.HeaderAppType,
	types.HeaderDeviceType,
	types.HeaderDeviceID,
	types.HeaderDeviceName,
	types.HeaderGoogleAppstore,
	types.HeaderCh,
	types.HeaderNight,
	types.HeaderDeviceToken,
	types.HeaderSignVersion,
	types.HeaderAppSign,
}

var v2SignHeaders = []string{
	types.HeaderAppKey,
	types.HeaderRandom,
	types.HeaderTime,
	types.HeaderAppLang,
	types.HeaderVersion,
	types.HeaderBuild,
	types.HeaderAppType,
	types.HeaderDeviceType,
	types.HeaderDeviceID,
	types.HeaderDeviceName,
	types.HeaderGoogleAppstore,
	types.HeaderCh,
	types.HeaderNight,
	types.HeaderDeviceToken,
	types.HeaderSignVersion,
	types.HeaderAppSign,
	types.HeaderAppToken,
}

type SignHeaders struct {
	AppKey            string `form:"app_key" json:"app_key" mapstructure:"app_key"`
	SignVersion       string `form:"sign_version" json:"sign_version" mapstructure:"sign_version"`
	Sign              string `form:"sign" json:"sign" mapstructure:"sign"`
	DeviceType        string `form:"device_type" json:"device_type" mapstructure:"device_type"`
	DeviceID          string `form:"device_id" json:"device_id" mapstructure:"device_id"`
	IgnoreGateWaySign string `json:"ignore_gate_way_sign" form:"ignore_gate_way_sign" mapstructure:"ignore_gate_way_sign"`
}

type Web3Auth struct {
	credentials map[string]string
	switchOn    bool
	env         string
}

func NewWeb3Auth(credentials map[string]string, switchOn bool, env string) *Web3Auth {
	return &Web3Auth{
		credentials: credentials,
		switchOn:    switchOn,
		env:         env,
	}
}

type Web3AuthRequest struct {
	env            string
	request        *http.Request
	requestMapping map[string]any
	signHeaders    *SignHeaders
}

func NewWeb3AuthRequest(r *http.Request, env string) (*Web3AuthRequest, error) {
	authReq := &Web3AuthRequest{
		env:            env,
		request:        r,
		requestMapping: make(map[string]any),
	}

	err := authReq.parseHttpRequest()
	if err != nil {
		return nil, err
	}
	return authReq, nil
}

func (w *Web3Auth) Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !w.switchOn {
			c.Next()
			return
		}

		tl := tracelog.NewWithContext(c.Request.Context())
		authReq, err := NewWeb3AuthRequest(c.Request, w.env)
		if err != nil {
			tl.Errorw("NewWeb3AuthRequest failed", "error", err.Error())
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    http.StatusBadRequest,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		err = authReq.setSignHeaders()
		if err != nil {
			tl.Errorw("setSignHeaders failed", "error", err.Error())
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    http.StatusUnauthorized,
				"message": err.Error(),
			})
			c.Abort()
			return
		}

		if (authReq.signHeaders.SignVersion == "" ||
			authReq.signHeaders.SignVersion == SignVersionV1) &&
			(authReq.signHeaders.DeviceType == types.DeviceTypeWeb ||
				authReq.signHeaders.DeviceType == types.DeviceTypeH5) {
			c.Next()
			return
		}
		if strings.EqualFold(authReq.signHeaders.IgnoreGateWaySign, "1") {
			c.Next()
			return
		}

		localSign, signStr, err := w.calcMD5Sign(authReq)
		if err != nil {
			tl.Errorw("calcMD5Sign failed", "signStr", signStr, "error", err.Error())
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    http.StatusUnauthorized,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		if localSign != authReq.signHeaders.Sign {
			c.JSON(http.StatusUnauthorized, gin.H{
				"code":    http.StatusUnauthorized,
				"message": "sign mismatch",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func (w *Web3Auth) calcMD5Sign(authReq *Web3AuthRequest) (string, string, error) {
	signStr := authReq.buildSignString()
	key := authReq.signHeaders.AppKey
	secret, ok := w.credentials[key]
	if !ok {
		return "", "", errors.New("incorrect appKey")
	}

	signStr = key + signStr + secret
	md5String, err := utils.Md5Hex(signStr)
	if err != nil {
		return "", signStr, errors.Join(errors.New("calc md5 failed"), err)
	}
	return strings.ToLower(md5String[:32]), signStr, nil
}

func (w *Web3AuthRequest) parseHttpRequest() error {
	method := w.request.Method
	urlPath := w.request.URL.Path
	if w.request.Host == "www.hipo.com" {
		switch w.env {
		case "dev":
			urlPath = "/apitest" + urlPath
		case "release":
			urlPath = "/apistage" + urlPath
		}
	}
	queryMap := make(map[string]any)
	for k, v := range w.request.URL.Query() {
		if len(v) > 0 {
			queryMap[k] = v[0]
		}
	}
	headers := make(map[string]any)
	for name, values := range w.request.Header {
		if len(values) > 0 {
			headers[strings.ToLower(name)] = values[0]
		}
	}
	bodyBytes, err := io.ReadAll(w.request.Body)
	if err != nil {
		return errors.Join(errors.New("failed to read request body"), err)
	}
	w.request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	w.requestMapping = map[string]any{
		"method":  strings.ToUpper(method),
		"path":    urlPath,
		"query":   queryMap,
		"headers": headers,
		"body":    string(bodyBytes),
	}
	return nil
}

func (w *Web3AuthRequest) setSignHeaders() error {
	headerMap := w.requestMapping["headers"].(map[string]any)
	var ret SignHeaders

	if v, ok := headerMap[types.HeaderAppKey]; ok && v != nil {
		ret.AppKey = fmt.Sprintf("%v", v)
	}
	if v, ok := headerMap[types.HeaderSignVersion]; ok && v != nil {
		ret.SignVersion = fmt.Sprintf("%v", v)
	}
	if v, ok := headerMap[types.HeaderAppSign]; ok && v != nil {
		ret.Sign = fmt.Sprintf("%v", v)
	}
	if v, ok := headerMap[types.HeaderDeviceType]; ok && v != nil {
		ret.DeviceType = fmt.Sprintf("%v", v)
	}
	if v, ok := headerMap[types.HeaderDeviceID]; ok && v != nil {
		ret.DeviceID = fmt.Sprintf("%v", v)
	}
	if v, ok := headerMap[types.HeaderIgnoreGateWaySign]; ok && v != nil {
		ret.IgnoreGateWaySign = fmt.Sprintf("%v", v)
	}

	w.signHeaders = &ret

	return nil
}

func (w *Web3AuthRequest) buildSignString() string {
	signVersion := w.signHeaders.SignVersion
	m := w.requestMapping

	output := m["method"].(string)
	output += m["path"].(string)

	// query
	queryMapping := make(map[string]interface{})
	if query := m["query"].(map[string]any); query != nil {
		for k, v := range query {
			queryMapping[k] = v
		}
	}

	sortedKeys := sortMapKey(queryMapping)
	for _, key := range sortedKeys {
		output += key + fmt.Sprintf("%v", queryMapping[key])
	}

	headerMapping := make(map[string]interface{})
	headers := m["headers"].(map[string]any)
	if headers != nil {
		var signHeaders []string
		switch signVersion {
		case SignVersionV1:
			signHeaders = v1SignHeaders
		case SignVersionV2:
			signHeaders = v2SignHeaders
		}
		for _, header := range signHeaders {
			if value, ok := headers[header]; ok {
				headerMapping[header] = value
			}
		}
	}

	// body
	body := m["body"].(string)
	body = strings.ReplaceAll(body, " ", "")
	body = strings.ReplaceAll(body, "\n", "")
	output += body

	// headers
	sortedKeys = sortMapKey(headerMapping)
	for _, key := range sortedKeys {
		if key != types.HeaderAppSign {
			output += key + fmt.Sprintf("%v", headerMapping[key])
		}
	}

	return output
}

func sortMapKey(input map[string]interface{}) []string {
	var keys []string
	for k := range input {
		keys = append(keys, k)
	}

	sort.Strings(keys)

	return keys
}
