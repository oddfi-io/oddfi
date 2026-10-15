package httpclient

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"chain_crawler/pkg/tracelog"

	"github.com/eapache/go-resiliency/retrier"
	"github.com/stretchr/testify/assert"
	retry "gopkg.in/h2non/gentleman-retry.v2"
	"gopkg.in/h2non/gentleman.v2/plugins/timeout"
)

func init() {
	tracelog.InitTrace("web3", "token")
	tracelog.InitLogger("dev")
}

type testRes struct {
	ErrNo  int64  `json:"errno"`
	ErrMsg string `json:"errmsg"`
}

func TestHttpRpc(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rpc", func(w http.ResponseWriter, r *http.Request) {
		b, _ := json.Marshal(testRes{
			ErrNo:  1,
			ErrMsg: r.Method,
		})
		if (r.Method == http.MethodPut || r.Method == http.MethodPost) && r.Header.Get("Content-Type") != ContentTypeJSON {
			b, _ = json.Marshal(testRes{
				ErrNo:  2,
				ErrMsg: "error",
			})
		}
		w.Write(b)
	})
	server := &http.Server{
		Addr:           ":8080",
		Handler:        mux,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	go func() {
		server.ListenAndServe()
	}()
	defer server.Shutdown(context.TODO())

	client := NewHttpClient()

	// 测试Get
	var res testRes
	if err := client.Get(context.TODO(), "http://127.0.0.1:8080/rpc", nil, map[string]string{}, &res); err != nil {
		t.Fatalf("client.Get error %+v", err)
	} else if res.ErrMsg != http.MethodGet {
		t.Fatalf("client.Get data error %+v", res)
	}
	if err := client.Post(context.TODO(), "http://127.0.0.1:8080/rpc", nil, map[string]interface{}{}, &res); err != nil {
		t.Fatalf("client.Get error %+v", err)
	} else if res.ErrMsg != http.MethodPost {
		t.Fatalf("client.Get data error %+v", res)
	}
}

func TestHttpRpcEx(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rpc", func(w http.ResponseWriter, r *http.Request) {
		b, _ := json.Marshal(testRes{
			ErrNo:  1,
			ErrMsg: r.Method,
		})
		if (r.Method == http.MethodPut || r.Method == http.MethodPost) && r.Header.Get("Content-Type") != ContentTypeJSON {
			b, _ = json.Marshal(testRes{
				ErrNo:  2,
				ErrMsg: "error",
			})
		}
		if r.Header.Get("header-test") != "httprpc" {
			b, _ = json.Marshal(testRes{
				ErrNo:  2,
				ErrMsg: "error",
			})
		}
		w.Write(b)
	})
	server := &http.Server{
		Addr:           ":8080",
		Handler:        mux,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	go func() {
		server.ListenAndServe()
	}()
	defer server.Shutdown(context.TODO())

	client := NewHttpClient()

	// 测试Get
	var res testRes
	if err := client.Get(context.TODO(), "http://127.0.0.1:8080/rpc", map[string]string{"header-test": "httprpc"}, map[string]string{}, &res); err != nil {
		t.Fatalf("client.Get error %+v", err)
	} else if res.ErrMsg != http.MethodGet {
		t.Fatalf("client.Get data error %+v", res)
	}
	if err := client.Post(context.TODO(), "http://127.0.0.1:8080/rpc", map[string]string{"header-test": "httprpc"}, map[string]interface{}{}, &res); err != nil {
		t.Fatalf("client.Get error %+v", err)
	} else if res.ErrMsg != http.MethodPost {
		t.Fatalf("client.Get data error %+v", res)
	}
}

type Param struct {
	Key string `json:"key"`
}

func TestHttpRpcRetry(t *testing.T) {
	hasRPC := false
	mux := http.NewServeMux()
	mux.HandleFunc("/rpc", func(w http.ResponseWriter, r *http.Request) {
		var req Param
		reqByte, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("ioutil.ReadAll error %+v", err)
		}
		if err = json.Unmarshal(reqByte, &req); err != nil {
			t.Fatalf("json.Unmarshal error %+v", err)
		}
		if req.Key != "value" {
			b, _ := json.Marshal(testRes{
				ErrNo:  1,
				ErrMsg: r.Method,
			})
			w.Write(b)
			return
		}
		if !hasRPC {
			hasRPC = true
			time.Sleep(2 * time.Second)
		}
		b, _ := json.Marshal(testRes{
			ErrNo:  0,
			ErrMsg: r.Method,
		})
		w.Write(b)
	})
	server := &http.Server{
		Addr:           "127.0.0.1:8080",
		Handler:        mux,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	go func() {
		server.ListenAndServe()
	}()
	defer server.Shutdown(context.TODO())

	client := NewHttpClient(timeout.Request(time.Second))

	// 测试Get
	var res testRes
	if err := client.Post(context.TODO(), "http://127.0.0.1:8080/rpc", map[string]string{}, Param{
		Key: "value",
	}, &res, retry.New(retrier.New(retrier.ConstantBackoff(3, time.Second*2), retrier.DefaultClassifier{}))); err != nil {
		t.Fatalf("client.Get error %+v", err)
	} else if res.ErrNo != 0 || res.ErrMsg != http.MethodPost {
		t.Fatalf("client.Get data error %+v", res)
	}
}

func TestHttpErrorRetry(t *testing.T) {
	hasRPC := false
	mux := http.NewServeMux()
	mux.HandleFunc("/rpc", func(w http.ResponseWriter, r *http.Request) {
		if !hasRPC {
			hasRPC = true
			time.Sleep(3 * time.Second)
		}
		b, _ := json.Marshal(testRes{
			ErrNo:  0,
			ErrMsg: "success",
		})
		w.Write(b)
	})
	server := &http.Server{
		Addr:           "127.0.0.1:8080",
		Handler:        mux,
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}
	go func() {
		server.ListenAndServe()
	}()
	defer server.Shutdown(context.TODO())

	// 测试Get 成功 case1
	client := NewHttpClient(timeout.Request(6*time.Second), retry.New(retrier.New(retrier.ExponentialBackoff(3, 100*time.Millisecond), nil)))
	var res testRes
	err := client.Get(context.TODO(), "http://127.0.0.1:8080/rpc", map[string]string{}, nil, &res)
	assert.NoError(t, err)

	// 测试Get 成功
	hasRPC = false
	client = NewHttpClient(timeout.Request(5 * time.Second))
	res = testRes{}
	if err := client.Get(context.TODO(), "http://127.0.0.1:8080/rpc", map[string]string{}, nil, &res); err != nil {
		t.Fatalf("client.Get error %+v", err)
	} else if res.ErrNo != 0 || res.ErrMsg != "success" {
		t.Fatalf("client.Get data error %+v", res)
	}
}
