// Package bindings hosts abigen-generated Go bindings for OddFi contracts.
//
// Run `go generate ./bindings/...` after `make pull-abi` to regenerate.
// Generated files are committed to git so consumers do not need abigen installed.
package bindings

//go:generate go run github.com/ethereum/go-ethereum/cmd/abigen@v1.14.13 --abi=../abi/BettingPool.abi.json --pkg=bettingpool --type=BettingPool --out=./bettingpool/bettingpool.go
//go:generate go run github.com/ethereum/go-ethereum/cmd/abigen@v1.14.13 --abi=../abi/ERC20.abi.json --pkg=erc20 --type=ERC20 --out=./erc20/erc20.go
