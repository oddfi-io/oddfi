package validator

import (
	"chain_crawler/pkg/consts"
	"chain_crawler/pkg/ethclient"
	"chain_crawler/pkg/tracelog"
	"chain_crawler/pkg/web3chain"
	"context"
	"fmt"
)

type EvmChainIdValidator struct{}

// Validate 验证chainId
func (v *EvmChainIdValidator) Validate(ctx context.Context, chainInfo *web3chain.Chain, evmClient ethclient.EthClient) error {
	evmChainIdValidatorSpanCtx, evmChainIdValidatorSpan := tracelog.StartSpan(ctx, "evm", "Validate")
	defer evmChainIdValidatorSpan.End()
	tl := tracelog.NewWithContext(evmChainIdValidatorSpanCtx)
	tl.Info("Starting validate evm chain id")
	expectedChainId := consts.GetChainIdByChain(chainInfo.Chain)
	if expectedChainId == 0 {
		tl.Errorw("EvmChainIdValidator invalid expected chainId", "chain", chainInfo.Chain, "expectedChainId", expectedChainId)
		return fmt.Errorf("EvmChainIdValidator invalid expected chainId:%d of chain:%s", expectedChainId, chainInfo.Chain)
	}
	// chainId, err := evmClient.NetVersion(ctx, ethclient.RouteRandom)
	// if err != nil {
	// 	tl.Errorw("EvmChainIdValidator NetVersion failed", "chain", chainInfo.Chain, "error", err)
	// 	return err
	// }
	// if chainId != expectedChainId {
	// 	tl.Errorw("EvmChainIdValidator chainId mismatch", "chain", chainInfo.Chain, "chainId", chainId, "expected", expectedChainId)
	// 	return fmt.Errorf("chainId mismatch expected %d, got %d", expectedChainId, chainId)
	// }
	//tl.Infow("EvmChainIdValidator chainId matched", "chain", chainInfo.Chain, "chainId", chainId)
	return nil
}
