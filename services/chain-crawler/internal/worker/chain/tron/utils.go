package tron

import (
	"fmt"
	"net/url"
)

func GetTronRpcEndpoints(endpoints []string) ([]string, []string, error) {
	var restRpcUrls, jsonRpcUrls []string
	for _, endpoint := range endpoints {
		// eg: http://web3-rpc-service.web3-test.svc.cluster.local:8080/internal/0xwZskfhDatawork/web3rpc/v1/http/tron/?_bs_protocol_=jsonrpc
		u, err := url.Parse(endpoint)
		if err != nil {
			return nil, nil, fmt.Errorf("url.Parse endpoint:%s error: %w", endpoint, err)

		}
		jsonRpcUrls = append(jsonRpcUrls, u.String())
		u.RawQuery = "" //去掉查询参数
		restRpcUrls = append(restRpcUrls, u.String())
	}
	return restRpcUrls, jsonRpcUrls, nil
}
