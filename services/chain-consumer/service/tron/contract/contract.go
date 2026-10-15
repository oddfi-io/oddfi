// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package tron_contract

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Contract address : TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
// C:\Users\Administrator\go\bin\abigen.exe --abi contract.abi --pkg tron_contract --type MyContract --out contract.go --alias _totalSupply=TotalSupplyVar
// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// MyContractMetaData contains all meta data concerning the MyContract contract.
var MyContractMetaData = &bind.MetaData{
	ABI: "[{\"constant\":true,\"inputs\":[],\"name\":\"name\",\"outputs\":[{\"name\":\"\",\"type\":\"string\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_upgradedAddress\",\"type\":\"address\"}],\"name\":\"deprecate\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_spender\",\"type\":\"address\"},{\"name\":\"_value\",\"type\":\"uint256\"}],\"name\":\"approve\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"deprecated\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_evilUser\",\"type\":\"address\"}],\"name\":\"addBlackList\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"totalSupply\",\"outputs\":[{\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_from\",\"type\":\"address\"},{\"name\":\"_to\",\"type\":\"address\"},{\"name\":\"_value\",\"type\":\"uint256\"}],\"name\":\"transferFrom\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"upgradedAddress\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"decimals\",\"outputs\":[{\"name\":\"\",\"type\":\"uint8\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"maximumFee\",\"outputs\":[{\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"_totalSupply\",\"outputs\":[{\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[],\"name\":\"unpause\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"name\":\"_maker\",\"type\":\"address\"}],\"name\":\"getBlackListStatus\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"paused\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_spender\",\"type\":\"address\"},{\"name\":\"_subtractedValue\",\"type\":\"uint256\"}],\"name\":\"decreaseApproval\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"name\":\"who\",\"type\":\"address\"}],\"name\":\"balanceOf\",\"outputs\":[{\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"name\":\"_value\",\"type\":\"uint256\"}],\"name\":\"calcFee\",\"outputs\":[{\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[],\"name\":\"pause\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"owner\",\"outputs\":[{\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"symbol\",\"outputs\":[{\"name\":\"\",\"type\":\"string\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_to\",\"type\":\"address\"},{\"name\":\"_value\",\"type\":\"uint256\"}],\"name\":\"transfer\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"name\":\"who\",\"type\":\"address\"}],\"name\":\"oldBalanceOf\",\"outputs\":[{\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"newBasisPoints\",\"type\":\"uint256\"},{\"name\":\"newMaxFee\",\"type\":\"uint256\"}],\"name\":\"setParams\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"issue\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_spender\",\"type\":\"address\"},{\"name\":\"_addedValue\",\"type\":\"uint256\"}],\"name\":\"increaseApproval\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"redeem\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"name\":\"_owner\",\"type\":\"address\"},{\"name\":\"_spender\",\"type\":\"address\"}],\"name\":\"allowance\",\"outputs\":[{\"name\":\"remaining\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"basisPointsRate\",\"outputs\":[{\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"name\":\"\",\"type\":\"address\"}],\"name\":\"isBlackListed\",\"outputs\":[{\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_clearedUser\",\"type\":\"address\"}],\"name\":\"removeBlackList\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"MAX_UINT\",\"outputs\":[{\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"transferOwnership\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"name\":\"_blackListedUser\",\"type\":\"address\"}],\"name\":\"destroyBlackFunds\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"name\":\"_initialSupply\",\"type\":\"uint256\"},{\"name\":\"_name\",\"type\":\"string\"},{\"name\":\"_symbol\",\"type\":\"string\"},{\"name\":\"_decimals\",\"type\":\"uint8\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"_blackListedUser\",\"type\":\"address\"},{\"indexed\":false,\"name\":\"_balance\",\"type\":\"uint256\"}],\"name\":\"DestroyedBlackFunds\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"Issue\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"Redeem\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"name\":\"newAddress\",\"type\":\"address\"}],\"name\":\"Deprecate\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"_user\",\"type\":\"address\"}],\"name\":\"AddedBlackList\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"_user\",\"type\":\"address\"}],\"name\":\"RemovedBlackList\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"name\":\"feeBasisPoints\",\"type\":\"uint256\"},{\"indexed\":false,\"name\":\"maxFee\",\"type\":\"uint256\"}],\"name\":\"Params\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[],\"name\":\"Pause\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[],\"name\":\"Unpause\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"previousOwner\",\"type\":\"address\"},{\"indexed\":true,\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"OwnershipTransferred\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"owner\",\"type\":\"address\"},{\"indexed\":true,\"name\":\"spender\",\"type\":\"address\"},{\"indexed\":false,\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"Approval\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"name\":\"from\",\"type\":\"address\"},{\"indexed\":true,\"name\":\"to\",\"type\":\"address\"},{\"indexed\":false,\"name\":\"value\",\"type\":\"uint256\"}],\"name\":\"Transfer\",\"type\":\"event\"}]",
}

// MyContractABI is the input ABI used to generate the binding from.
// Deprecated: Use MyContractMetaData.ABI instead.
var MyContractABI = MyContractMetaData.ABI

// MyContract is an auto generated Go binding around an Ethereum contract.
type MyContract struct {
	MyContractCaller     // Read-only binding to the contract
	MyContractTransactor // Write-only binding to the contract
	MyContractFilterer   // Log filterer for contract events
}

// MyContractCaller is an auto generated read-only Go binding around an Ethereum contract.
type MyContractCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// MyContractTransactor is an auto generated write-only Go binding around an Ethereum contract.
type MyContractTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// MyContractFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type MyContractFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// MyContractSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type MyContractSession struct {
	Contract     *MyContract       // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// MyContractCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type MyContractCallerSession struct {
	Contract *MyContractCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts     // Call options to use throughout this session
}

// MyContractTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type MyContractTransactorSession struct {
	Contract     *MyContractTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts     // Transaction auth options to use throughout this session
}

// MyContractRaw is an auto generated low-level Go binding around an Ethereum contract.
type MyContractRaw struct {
	Contract *MyContract // Generic contract binding to access the raw methods on
}

// MyContractCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type MyContractCallerRaw struct {
	Contract *MyContractCaller // Generic read-only contract binding to access the raw methods on
}

// MyContractTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type MyContractTransactorRaw struct {
	Contract *MyContractTransactor // Generic write-only contract binding to access the raw methods on
}

// NewMyContract creates a new instance of MyContract, bound to a specific deployed contract.
func NewMyContract(address common.Address, backend bind.ContractBackend) (*MyContract, error) {
	contract, err := bindMyContract(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &MyContract{MyContractCaller: MyContractCaller{contract: contract}, MyContractTransactor: MyContractTransactor{contract: contract}, MyContractFilterer: MyContractFilterer{contract: contract}}, nil
}

// NewMyContractCaller creates a new read-only instance of MyContract, bound to a specific deployed contract.
func NewMyContractCaller(address common.Address, caller bind.ContractCaller) (*MyContractCaller, error) {
	contract, err := bindMyContract(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &MyContractCaller{contract: contract}, nil
}

// NewMyContractTransactor creates a new write-only instance of MyContract, bound to a specific deployed contract.
func NewMyContractTransactor(address common.Address, transactor bind.ContractTransactor) (*MyContractTransactor, error) {
	contract, err := bindMyContract(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &MyContractTransactor{contract: contract}, nil
}

// NewMyContractFilterer creates a new log filterer instance of MyContract, bound to a specific deployed contract.
func NewMyContractFilterer(address common.Address, filterer bind.ContractFilterer) (*MyContractFilterer, error) {
	contract, err := bindMyContract(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &MyContractFilterer{contract: contract}, nil
}

// bindMyContract binds a generic wrapper to an already deployed contract.
func bindMyContract(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := MyContractMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_MyContract *MyContractRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _MyContract.Contract.MyContractCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_MyContract *MyContractRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _MyContract.Contract.MyContractTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_MyContract *MyContractRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _MyContract.Contract.MyContractTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_MyContract *MyContractCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _MyContract.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_MyContract *MyContractTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _MyContract.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_MyContract *MyContractTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _MyContract.Contract.contract.Transact(opts, method, params...)
}

// MAXUINT is a free data retrieval call binding the contract method 0xe5b5019a.
//
// Solidity: function MAX_UINT() view returns(uint256)
func (_MyContract *MyContractCaller) MAXUINT(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "MAX_UINT")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// MAXUINT is a free data retrieval call binding the contract method 0xe5b5019a.
//
// Solidity: function MAX_UINT() view returns(uint256)
func (_MyContract *MyContractSession) MAXUINT() (*big.Int, error) {
	return _MyContract.Contract.MAXUINT(&_MyContract.CallOpts)
}

// MAXUINT is a free data retrieval call binding the contract method 0xe5b5019a.
//
// Solidity: function MAX_UINT() view returns(uint256)
func (_MyContract *MyContractCallerSession) MAXUINT() (*big.Int, error) {
	return _MyContract.Contract.MAXUINT(&_MyContract.CallOpts)
}

// TotalSupplyVar is a free data retrieval call binding the contract method 0x3eaaf86b.
//
// Solidity: function _totalSupply() view returns(uint256)
func (_MyContract *MyContractCaller) TotalSupplyVar(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "_totalSupply")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalSupplyVar is a free data retrieval call binding the contract method 0x3eaaf86b.
//
// Solidity: function _totalSupply() view returns(uint256)
func (_MyContract *MyContractSession) TotalSupplyVar() (*big.Int, error) {
	return _MyContract.Contract.TotalSupplyVar(&_MyContract.CallOpts)
}

// TotalSupplyVar is a free data retrieval call binding the contract method 0x3eaaf86b.
//
// Solidity: function _totalSupply() view returns(uint256)
func (_MyContract *MyContractCallerSession) TotalSupplyVar() (*big.Int, error) {
	return _MyContract.Contract.TotalSupplyVar(&_MyContract.CallOpts)
}

// Allowance is a free data retrieval call binding the contract method 0xdd62ed3e.
//
// Solidity: function allowance(address _owner, address _spender) view returns(uint256 remaining)
func (_MyContract *MyContractCaller) Allowance(opts *bind.CallOpts, _owner common.Address, _spender common.Address) (*big.Int, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "allowance", _owner, _spender)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// Allowance is a free data retrieval call binding the contract method 0xdd62ed3e.
//
// Solidity: function allowance(address _owner, address _spender) view returns(uint256 remaining)
func (_MyContract *MyContractSession) Allowance(_owner common.Address, _spender common.Address) (*big.Int, error) {
	return _MyContract.Contract.Allowance(&_MyContract.CallOpts, _owner, _spender)
}

// Allowance is a free data retrieval call binding the contract method 0xdd62ed3e.
//
// Solidity: function allowance(address _owner, address _spender) view returns(uint256 remaining)
func (_MyContract *MyContractCallerSession) Allowance(_owner common.Address, _spender common.Address) (*big.Int, error) {
	return _MyContract.Contract.Allowance(&_MyContract.CallOpts, _owner, _spender)
}

// BalanceOf is a free data retrieval call binding the contract method 0x70a08231.
//
// Solidity: function balanceOf(address who) view returns(uint256)
func (_MyContract *MyContractCaller) BalanceOf(opts *bind.CallOpts, who common.Address) (*big.Int, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "balanceOf", who)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// BalanceOf is a free data retrieval call binding the contract method 0x70a08231.
//
// Solidity: function balanceOf(address who) view returns(uint256)
func (_MyContract *MyContractSession) BalanceOf(who common.Address) (*big.Int, error) {
	return _MyContract.Contract.BalanceOf(&_MyContract.CallOpts, who)
}

// BalanceOf is a free data retrieval call binding the contract method 0x70a08231.
//
// Solidity: function balanceOf(address who) view returns(uint256)
func (_MyContract *MyContractCallerSession) BalanceOf(who common.Address) (*big.Int, error) {
	return _MyContract.Contract.BalanceOf(&_MyContract.CallOpts, who)
}

// BasisPointsRate is a free data retrieval call binding the contract method 0xdd644f72.
//
// Solidity: function basisPointsRate() view returns(uint256)
func (_MyContract *MyContractCaller) BasisPointsRate(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "basisPointsRate")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// BasisPointsRate is a free data retrieval call binding the contract method 0xdd644f72.
//
// Solidity: function basisPointsRate() view returns(uint256)
func (_MyContract *MyContractSession) BasisPointsRate() (*big.Int, error) {
	return _MyContract.Contract.BasisPointsRate(&_MyContract.CallOpts)
}

// BasisPointsRate is a free data retrieval call binding the contract method 0xdd644f72.
//
// Solidity: function basisPointsRate() view returns(uint256)
func (_MyContract *MyContractCallerSession) BasisPointsRate() (*big.Int, error) {
	return _MyContract.Contract.BasisPointsRate(&_MyContract.CallOpts)
}

// CalcFee is a free data retrieval call binding the contract method 0x75dc7d8c.
//
// Solidity: function calcFee(uint256 _value) view returns(uint256)
func (_MyContract *MyContractCaller) CalcFee(opts *bind.CallOpts, _value *big.Int) (*big.Int, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "calcFee", _value)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// CalcFee is a free data retrieval call binding the contract method 0x75dc7d8c.
//
// Solidity: function calcFee(uint256 _value) view returns(uint256)
func (_MyContract *MyContractSession) CalcFee(_value *big.Int) (*big.Int, error) {
	return _MyContract.Contract.CalcFee(&_MyContract.CallOpts, _value)
}

// CalcFee is a free data retrieval call binding the contract method 0x75dc7d8c.
//
// Solidity: function calcFee(uint256 _value) view returns(uint256)
func (_MyContract *MyContractCallerSession) CalcFee(_value *big.Int) (*big.Int, error) {
	return _MyContract.Contract.CalcFee(&_MyContract.CallOpts, _value)
}

// Decimals is a free data retrieval call binding the contract method 0x313ce567.
//
// Solidity: function decimals() view returns(uint8)
func (_MyContract *MyContractCaller) Decimals(opts *bind.CallOpts) (uint8, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "decimals")

	if err != nil {
		return *new(uint8), err
	}

	out0 := *abi.ConvertType(out[0], new(uint8)).(*uint8)

	return out0, err

}

// Decimals is a free data retrieval call binding the contract method 0x313ce567.
//
// Solidity: function decimals() view returns(uint8)
func (_MyContract *MyContractSession) Decimals() (uint8, error) {
	return _MyContract.Contract.Decimals(&_MyContract.CallOpts)
}

// Decimals is a free data retrieval call binding the contract method 0x313ce567.
//
// Solidity: function decimals() view returns(uint8)
func (_MyContract *MyContractCallerSession) Decimals() (uint8, error) {
	return _MyContract.Contract.Decimals(&_MyContract.CallOpts)
}

// Deprecated is a free data retrieval call binding the contract method 0x0e136b19.
//
// Solidity: function deprecated() view returns(bool)
func (_MyContract *MyContractCaller) Deprecated(opts *bind.CallOpts) (bool, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "deprecated")

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// Deprecated is a free data retrieval call binding the contract method 0x0e136b19.
//
// Solidity: function deprecated() view returns(bool)
func (_MyContract *MyContractSession) Deprecated() (bool, error) {
	return _MyContract.Contract.Deprecated(&_MyContract.CallOpts)
}

// Deprecated is a free data retrieval call binding the contract method 0x0e136b19.
//
// Solidity: function deprecated() view returns(bool)
func (_MyContract *MyContractCallerSession) Deprecated() (bool, error) {
	return _MyContract.Contract.Deprecated(&_MyContract.CallOpts)
}

// GetBlackListStatus is a free data retrieval call binding the contract method 0x59bf1abe.
//
// Solidity: function getBlackListStatus(address _maker) view returns(bool)
func (_MyContract *MyContractCaller) GetBlackListStatus(opts *bind.CallOpts, _maker common.Address) (bool, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "getBlackListStatus", _maker)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// GetBlackListStatus is a free data retrieval call binding the contract method 0x59bf1abe.
//
// Solidity: function getBlackListStatus(address _maker) view returns(bool)
func (_MyContract *MyContractSession) GetBlackListStatus(_maker common.Address) (bool, error) {
	return _MyContract.Contract.GetBlackListStatus(&_MyContract.CallOpts, _maker)
}

// GetBlackListStatus is a free data retrieval call binding the contract method 0x59bf1abe.
//
// Solidity: function getBlackListStatus(address _maker) view returns(bool)
func (_MyContract *MyContractCallerSession) GetBlackListStatus(_maker common.Address) (bool, error) {
	return _MyContract.Contract.GetBlackListStatus(&_MyContract.CallOpts, _maker)
}

// IsBlackListed is a free data retrieval call binding the contract method 0xe47d6060.
//
// Solidity: function isBlackListed(address ) view returns(bool)
func (_MyContract *MyContractCaller) IsBlackListed(opts *bind.CallOpts, arg0 common.Address) (bool, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "isBlackListed", arg0)

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// IsBlackListed is a free data retrieval call binding the contract method 0xe47d6060.
//
// Solidity: function isBlackListed(address ) view returns(bool)
func (_MyContract *MyContractSession) IsBlackListed(arg0 common.Address) (bool, error) {
	return _MyContract.Contract.IsBlackListed(&_MyContract.CallOpts, arg0)
}

// IsBlackListed is a free data retrieval call binding the contract method 0xe47d6060.
//
// Solidity: function isBlackListed(address ) view returns(bool)
func (_MyContract *MyContractCallerSession) IsBlackListed(arg0 common.Address) (bool, error) {
	return _MyContract.Contract.IsBlackListed(&_MyContract.CallOpts, arg0)
}

// MaximumFee is a free data retrieval call binding the contract method 0x35390714.
//
// Solidity: function maximumFee() view returns(uint256)
func (_MyContract *MyContractCaller) MaximumFee(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "maximumFee")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// MaximumFee is a free data retrieval call binding the contract method 0x35390714.
//
// Solidity: function maximumFee() view returns(uint256)
func (_MyContract *MyContractSession) MaximumFee() (*big.Int, error) {
	return _MyContract.Contract.MaximumFee(&_MyContract.CallOpts)
}

// MaximumFee is a free data retrieval call binding the contract method 0x35390714.
//
// Solidity: function maximumFee() view returns(uint256)
func (_MyContract *MyContractCallerSession) MaximumFee() (*big.Int, error) {
	return _MyContract.Contract.MaximumFee(&_MyContract.CallOpts)
}

// Name is a free data retrieval call binding the contract method 0x06fdde03.
//
// Solidity: function name() view returns(string)
func (_MyContract *MyContractCaller) Name(opts *bind.CallOpts) (string, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "name")

	if err != nil {
		return *new(string), err
	}

	out0 := *abi.ConvertType(out[0], new(string)).(*string)

	return out0, err

}

// Name is a free data retrieval call binding the contract method 0x06fdde03.
//
// Solidity: function name() view returns(string)
func (_MyContract *MyContractSession) Name() (string, error) {
	return _MyContract.Contract.Name(&_MyContract.CallOpts)
}

// Name is a free data retrieval call binding the contract method 0x06fdde03.
//
// Solidity: function name() view returns(string)
func (_MyContract *MyContractCallerSession) Name() (string, error) {
	return _MyContract.Contract.Name(&_MyContract.CallOpts)
}

// OldBalanceOf is a free data retrieval call binding the contract method 0xb7a3446c.
//
// Solidity: function oldBalanceOf(address who) view returns(uint256)
func (_MyContract *MyContractCaller) OldBalanceOf(opts *bind.CallOpts, who common.Address) (*big.Int, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "oldBalanceOf", who)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// OldBalanceOf is a free data retrieval call binding the contract method 0xb7a3446c.
//
// Solidity: function oldBalanceOf(address who) view returns(uint256)
func (_MyContract *MyContractSession) OldBalanceOf(who common.Address) (*big.Int, error) {
	return _MyContract.Contract.OldBalanceOf(&_MyContract.CallOpts, who)
}

// OldBalanceOf is a free data retrieval call binding the contract method 0xb7a3446c.
//
// Solidity: function oldBalanceOf(address who) view returns(uint256)
func (_MyContract *MyContractCallerSession) OldBalanceOf(who common.Address) (*big.Int, error) {
	return _MyContract.Contract.OldBalanceOf(&_MyContract.CallOpts, who)
}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (_MyContract *MyContractCaller) Owner(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "owner")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (_MyContract *MyContractSession) Owner() (common.Address, error) {
	return _MyContract.Contract.Owner(&_MyContract.CallOpts)
}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (_MyContract *MyContractCallerSession) Owner() (common.Address, error) {
	return _MyContract.Contract.Owner(&_MyContract.CallOpts)
}

// Paused is a free data retrieval call binding the contract method 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (_MyContract *MyContractCaller) Paused(opts *bind.CallOpts) (bool, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "paused")

	if err != nil {
		return *new(bool), err
	}

	out0 := *abi.ConvertType(out[0], new(bool)).(*bool)

	return out0, err

}

// Paused is a free data retrieval call binding the contract method 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (_MyContract *MyContractSession) Paused() (bool, error) {
	return _MyContract.Contract.Paused(&_MyContract.CallOpts)
}

// Paused is a free data retrieval call binding the contract method 0x5c975abb.
//
// Solidity: function paused() view returns(bool)
func (_MyContract *MyContractCallerSession) Paused() (bool, error) {
	return _MyContract.Contract.Paused(&_MyContract.CallOpts)
}

// Symbol is a free data retrieval call binding the contract method 0x95d89b41.
//
// Solidity: function symbol() view returns(string)
func (_MyContract *MyContractCaller) Symbol(opts *bind.CallOpts) (string, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "symbol")

	if err != nil {
		return *new(string), err
	}

	out0 := *abi.ConvertType(out[0], new(string)).(*string)

	return out0, err

}

// Symbol is a free data retrieval call binding the contract method 0x95d89b41.
//
// Solidity: function symbol() view returns(string)
func (_MyContract *MyContractSession) Symbol() (string, error) {
	return _MyContract.Contract.Symbol(&_MyContract.CallOpts)
}

// Symbol is a free data retrieval call binding the contract method 0x95d89b41.
//
// Solidity: function symbol() view returns(string)
func (_MyContract *MyContractCallerSession) Symbol() (string, error) {
	return _MyContract.Contract.Symbol(&_MyContract.CallOpts)
}

// TotalSupply is a free data retrieval call binding the contract method 0x18160ddd.
//
// Solidity: function totalSupply() view returns(uint256)
func (_MyContract *MyContractCaller) TotalSupply(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "totalSupply")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// TotalSupply is a free data retrieval call binding the contract method 0x18160ddd.
//
// Solidity: function totalSupply() view returns(uint256)
func (_MyContract *MyContractSession) TotalSupply() (*big.Int, error) {
	return _MyContract.Contract.TotalSupply(&_MyContract.CallOpts)
}

// TotalSupply is a free data retrieval call binding the contract method 0x18160ddd.
//
// Solidity: function totalSupply() view returns(uint256)
func (_MyContract *MyContractCallerSession) TotalSupply() (*big.Int, error) {
	return _MyContract.Contract.TotalSupply(&_MyContract.CallOpts)
}

// UpgradedAddress is a free data retrieval call binding the contract method 0x26976e3f.
//
// Solidity: function upgradedAddress() view returns(address)
func (_MyContract *MyContractCaller) UpgradedAddress(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _MyContract.contract.Call(opts, &out, "upgradedAddress")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// UpgradedAddress is a free data retrieval call binding the contract method 0x26976e3f.
//
// Solidity: function upgradedAddress() view returns(address)
func (_MyContract *MyContractSession) UpgradedAddress() (common.Address, error) {
	return _MyContract.Contract.UpgradedAddress(&_MyContract.CallOpts)
}

// UpgradedAddress is a free data retrieval call binding the contract method 0x26976e3f.
//
// Solidity: function upgradedAddress() view returns(address)
func (_MyContract *MyContractCallerSession) UpgradedAddress() (common.Address, error) {
	return _MyContract.Contract.UpgradedAddress(&_MyContract.CallOpts)
}

// AddBlackList is a paid mutator transaction binding the contract method 0x0ecb93c0.
//
// Solidity: function addBlackList(address _evilUser) returns()
func (_MyContract *MyContractTransactor) AddBlackList(opts *bind.TransactOpts, _evilUser common.Address) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "addBlackList", _evilUser)
}

// AddBlackList is a paid mutator transaction binding the contract method 0x0ecb93c0.
//
// Solidity: function addBlackList(address _evilUser) returns()
func (_MyContract *MyContractSession) AddBlackList(_evilUser common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.AddBlackList(&_MyContract.TransactOpts, _evilUser)
}

// AddBlackList is a paid mutator transaction binding the contract method 0x0ecb93c0.
//
// Solidity: function addBlackList(address _evilUser) returns()
func (_MyContract *MyContractTransactorSession) AddBlackList(_evilUser common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.AddBlackList(&_MyContract.TransactOpts, _evilUser)
}

// Approve is a paid mutator transaction binding the contract method 0x095ea7b3.
//
// Solidity: function approve(address _spender, uint256 _value) returns(bool)
func (_MyContract *MyContractTransactor) Approve(opts *bind.TransactOpts, _spender common.Address, _value *big.Int) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "approve", _spender, _value)
}

// Approve is a paid mutator transaction binding the contract method 0x095ea7b3.
//
// Solidity: function approve(address _spender, uint256 _value) returns(bool)
func (_MyContract *MyContractSession) Approve(_spender common.Address, _value *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.Approve(&_MyContract.TransactOpts, _spender, _value)
}

// Approve is a paid mutator transaction binding the contract method 0x095ea7b3.
//
// Solidity: function approve(address _spender, uint256 _value) returns(bool)
func (_MyContract *MyContractTransactorSession) Approve(_spender common.Address, _value *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.Approve(&_MyContract.TransactOpts, _spender, _value)
}

// DecreaseApproval is a paid mutator transaction binding the contract method 0x66188463.
//
// Solidity: function decreaseApproval(address _spender, uint256 _subtractedValue) returns(bool)
func (_MyContract *MyContractTransactor) DecreaseApproval(opts *bind.TransactOpts, _spender common.Address, _subtractedValue *big.Int) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "decreaseApproval", _spender, _subtractedValue)
}

// DecreaseApproval is a paid mutator transaction binding the contract method 0x66188463.
//
// Solidity: function decreaseApproval(address _spender, uint256 _subtractedValue) returns(bool)
func (_MyContract *MyContractSession) DecreaseApproval(_spender common.Address, _subtractedValue *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.DecreaseApproval(&_MyContract.TransactOpts, _spender, _subtractedValue)
}

// DecreaseApproval is a paid mutator transaction binding the contract method 0x66188463.
//
// Solidity: function decreaseApproval(address _spender, uint256 _subtractedValue) returns(bool)
func (_MyContract *MyContractTransactorSession) DecreaseApproval(_spender common.Address, _subtractedValue *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.DecreaseApproval(&_MyContract.TransactOpts, _spender, _subtractedValue)
}

// Deprecate is a paid mutator transaction binding the contract method 0x0753c30c.
//
// Solidity: function deprecate(address _upgradedAddress) returns()
func (_MyContract *MyContractTransactor) Deprecate(opts *bind.TransactOpts, _upgradedAddress common.Address) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "deprecate", _upgradedAddress)
}

// Deprecate is a paid mutator transaction binding the contract method 0x0753c30c.
//
// Solidity: function deprecate(address _upgradedAddress) returns()
func (_MyContract *MyContractSession) Deprecate(_upgradedAddress common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.Deprecate(&_MyContract.TransactOpts, _upgradedAddress)
}

// Deprecate is a paid mutator transaction binding the contract method 0x0753c30c.
//
// Solidity: function deprecate(address _upgradedAddress) returns()
func (_MyContract *MyContractTransactorSession) Deprecate(_upgradedAddress common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.Deprecate(&_MyContract.TransactOpts, _upgradedAddress)
}

// DestroyBlackFunds is a paid mutator transaction binding the contract method 0xf3bdc228.
//
// Solidity: function destroyBlackFunds(address _blackListedUser) returns()
func (_MyContract *MyContractTransactor) DestroyBlackFunds(opts *bind.TransactOpts, _blackListedUser common.Address) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "destroyBlackFunds", _blackListedUser)
}

// DestroyBlackFunds is a paid mutator transaction binding the contract method 0xf3bdc228.
//
// Solidity: function destroyBlackFunds(address _blackListedUser) returns()
func (_MyContract *MyContractSession) DestroyBlackFunds(_blackListedUser common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.DestroyBlackFunds(&_MyContract.TransactOpts, _blackListedUser)
}

// DestroyBlackFunds is a paid mutator transaction binding the contract method 0xf3bdc228.
//
// Solidity: function destroyBlackFunds(address _blackListedUser) returns()
func (_MyContract *MyContractTransactorSession) DestroyBlackFunds(_blackListedUser common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.DestroyBlackFunds(&_MyContract.TransactOpts, _blackListedUser)
}

// IncreaseApproval is a paid mutator transaction binding the contract method 0xd73dd623.
//
// Solidity: function increaseApproval(address _spender, uint256 _addedValue) returns(bool)
func (_MyContract *MyContractTransactor) IncreaseApproval(opts *bind.TransactOpts, _spender common.Address, _addedValue *big.Int) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "increaseApproval", _spender, _addedValue)
}

// IncreaseApproval is a paid mutator transaction binding the contract method 0xd73dd623.
//
// Solidity: function increaseApproval(address _spender, uint256 _addedValue) returns(bool)
func (_MyContract *MyContractSession) IncreaseApproval(_spender common.Address, _addedValue *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.IncreaseApproval(&_MyContract.TransactOpts, _spender, _addedValue)
}

// IncreaseApproval is a paid mutator transaction binding the contract method 0xd73dd623.
//
// Solidity: function increaseApproval(address _spender, uint256 _addedValue) returns(bool)
func (_MyContract *MyContractTransactorSession) IncreaseApproval(_spender common.Address, _addedValue *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.IncreaseApproval(&_MyContract.TransactOpts, _spender, _addedValue)
}

// Issue is a paid mutator transaction binding the contract method 0xcc872b66.
//
// Solidity: function issue(uint256 amount) returns()
func (_MyContract *MyContractTransactor) Issue(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "issue", amount)
}

// Issue is a paid mutator transaction binding the contract method 0xcc872b66.
//
// Solidity: function issue(uint256 amount) returns()
func (_MyContract *MyContractSession) Issue(amount *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.Issue(&_MyContract.TransactOpts, amount)
}

// Issue is a paid mutator transaction binding the contract method 0xcc872b66.
//
// Solidity: function issue(uint256 amount) returns()
func (_MyContract *MyContractTransactorSession) Issue(amount *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.Issue(&_MyContract.TransactOpts, amount)
}

// Pause is a paid mutator transaction binding the contract method 0x8456cb59.
//
// Solidity: function pause() returns()
func (_MyContract *MyContractTransactor) Pause(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "pause")
}

// Pause is a paid mutator transaction binding the contract method 0x8456cb59.
//
// Solidity: function pause() returns()
func (_MyContract *MyContractSession) Pause() (*types.Transaction, error) {
	return _MyContract.Contract.Pause(&_MyContract.TransactOpts)
}

// Pause is a paid mutator transaction binding the contract method 0x8456cb59.
//
// Solidity: function pause() returns()
func (_MyContract *MyContractTransactorSession) Pause() (*types.Transaction, error) {
	return _MyContract.Contract.Pause(&_MyContract.TransactOpts)
}

// Redeem is a paid mutator transaction binding the contract method 0xdb006a75.
//
// Solidity: function redeem(uint256 amount) returns()
func (_MyContract *MyContractTransactor) Redeem(opts *bind.TransactOpts, amount *big.Int) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "redeem", amount)
}

// Redeem is a paid mutator transaction binding the contract method 0xdb006a75.
//
// Solidity: function redeem(uint256 amount) returns()
func (_MyContract *MyContractSession) Redeem(amount *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.Redeem(&_MyContract.TransactOpts, amount)
}

// Redeem is a paid mutator transaction binding the contract method 0xdb006a75.
//
// Solidity: function redeem(uint256 amount) returns()
func (_MyContract *MyContractTransactorSession) Redeem(amount *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.Redeem(&_MyContract.TransactOpts, amount)
}

// RemoveBlackList is a paid mutator transaction binding the contract method 0xe4997dc5.
//
// Solidity: function removeBlackList(address _clearedUser) returns()
func (_MyContract *MyContractTransactor) RemoveBlackList(opts *bind.TransactOpts, _clearedUser common.Address) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "removeBlackList", _clearedUser)
}

// RemoveBlackList is a paid mutator transaction binding the contract method 0xe4997dc5.
//
// Solidity: function removeBlackList(address _clearedUser) returns()
func (_MyContract *MyContractSession) RemoveBlackList(_clearedUser common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.RemoveBlackList(&_MyContract.TransactOpts, _clearedUser)
}

// RemoveBlackList is a paid mutator transaction binding the contract method 0xe4997dc5.
//
// Solidity: function removeBlackList(address _clearedUser) returns()
func (_MyContract *MyContractTransactorSession) RemoveBlackList(_clearedUser common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.RemoveBlackList(&_MyContract.TransactOpts, _clearedUser)
}

// SetParams is a paid mutator transaction binding the contract method 0xc0324c77.
//
// Solidity: function setParams(uint256 newBasisPoints, uint256 newMaxFee) returns()
func (_MyContract *MyContractTransactor) SetParams(opts *bind.TransactOpts, newBasisPoints *big.Int, newMaxFee *big.Int) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "setParams", newBasisPoints, newMaxFee)
}

// SetParams is a paid mutator transaction binding the contract method 0xc0324c77.
//
// Solidity: function setParams(uint256 newBasisPoints, uint256 newMaxFee) returns()
func (_MyContract *MyContractSession) SetParams(newBasisPoints *big.Int, newMaxFee *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.SetParams(&_MyContract.TransactOpts, newBasisPoints, newMaxFee)
}

// SetParams is a paid mutator transaction binding the contract method 0xc0324c77.
//
// Solidity: function setParams(uint256 newBasisPoints, uint256 newMaxFee) returns()
func (_MyContract *MyContractTransactorSession) SetParams(newBasisPoints *big.Int, newMaxFee *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.SetParams(&_MyContract.TransactOpts, newBasisPoints, newMaxFee)
}

// Transfer is a paid mutator transaction binding the contract method 0xa9059cbb.
//
// Solidity: function transfer(address _to, uint256 _value) returns(bool)
func (_MyContract *MyContractTransactor) Transfer(opts *bind.TransactOpts, _to common.Address, _value *big.Int) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "transfer", _to, _value)
}

// Transfer is a paid mutator transaction binding the contract method 0xa9059cbb.
//
// Solidity: function transfer(address _to, uint256 _value) returns(bool)
func (_MyContract *MyContractSession) Transfer(_to common.Address, _value *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.Transfer(&_MyContract.TransactOpts, _to, _value)
}

// Transfer is a paid mutator transaction binding the contract method 0xa9059cbb.
//
// Solidity: function transfer(address _to, uint256 _value) returns(bool)
func (_MyContract *MyContractTransactorSession) Transfer(_to common.Address, _value *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.Transfer(&_MyContract.TransactOpts, _to, _value)
}

// TransferFrom is a paid mutator transaction binding the contract method 0x23b872dd.
//
// Solidity: function transferFrom(address _from, address _to, uint256 _value) returns(bool)
func (_MyContract *MyContractTransactor) TransferFrom(opts *bind.TransactOpts, _from common.Address, _to common.Address, _value *big.Int) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "transferFrom", _from, _to, _value)
}

// TransferFrom is a paid mutator transaction binding the contract method 0x23b872dd.
//
// Solidity: function transferFrom(address _from, address _to, uint256 _value) returns(bool)
func (_MyContract *MyContractSession) TransferFrom(_from common.Address, _to common.Address, _value *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.TransferFrom(&_MyContract.TransactOpts, _from, _to, _value)
}

// TransferFrom is a paid mutator transaction binding the contract method 0x23b872dd.
//
// Solidity: function transferFrom(address _from, address _to, uint256 _value) returns(bool)
func (_MyContract *MyContractTransactorSession) TransferFrom(_from common.Address, _to common.Address, _value *big.Int) (*types.Transaction, error) {
	return _MyContract.Contract.TransferFrom(&_MyContract.TransactOpts, _from, _to, _value)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_MyContract *MyContractTransactor) TransferOwnership(opts *bind.TransactOpts, newOwner common.Address) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "transferOwnership", newOwner)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_MyContract *MyContractSession) TransferOwnership(newOwner common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.TransferOwnership(&_MyContract.TransactOpts, newOwner)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_MyContract *MyContractTransactorSession) TransferOwnership(newOwner common.Address) (*types.Transaction, error) {
	return _MyContract.Contract.TransferOwnership(&_MyContract.TransactOpts, newOwner)
}

// Unpause is a paid mutator transaction binding the contract method 0x3f4ba83a.
//
// Solidity: function unpause() returns()
func (_MyContract *MyContractTransactor) Unpause(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _MyContract.contract.Transact(opts, "unpause")
}

// Unpause is a paid mutator transaction binding the contract method 0x3f4ba83a.
//
// Solidity: function unpause() returns()
func (_MyContract *MyContractSession) Unpause() (*types.Transaction, error) {
	return _MyContract.Contract.Unpause(&_MyContract.TransactOpts)
}

// Unpause is a paid mutator transaction binding the contract method 0x3f4ba83a.
//
// Solidity: function unpause() returns()
func (_MyContract *MyContractTransactorSession) Unpause() (*types.Transaction, error) {
	return _MyContract.Contract.Unpause(&_MyContract.TransactOpts)
}

// MyContractAddedBlackListIterator is returned from FilterAddedBlackList and is used to iterate over the raw logs and unpacked data for AddedBlackList events raised by the MyContract contract.
type MyContractAddedBlackListIterator struct {
	Event *MyContractAddedBlackList // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractAddedBlackListIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractAddedBlackList)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractAddedBlackList)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractAddedBlackListIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractAddedBlackListIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractAddedBlackList represents a AddedBlackList event raised by the MyContract contract.
type MyContractAddedBlackList struct {
	User common.Address
	Raw  types.Log // Blockchain specific contextual infos
}

// FilterAddedBlackList is a free log retrieval operation binding the contract event 0x42e160154868087d6bfdc0ca23d96a1c1cfa32f1b72ba9ba27b69b98a0d819dc.
//
// Solidity: event AddedBlackList(address indexed _user)
func (_MyContract *MyContractFilterer) FilterAddedBlackList(opts *bind.FilterOpts, _user []common.Address) (*MyContractAddedBlackListIterator, error) {

	var _userRule []interface{}
	for _, _userItem := range _user {
		_userRule = append(_userRule, _userItem)
	}

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "AddedBlackList", _userRule)
	if err != nil {
		return nil, err
	}
	return &MyContractAddedBlackListIterator{contract: _MyContract.contract, event: "AddedBlackList", logs: logs, sub: sub}, nil
}

// WatchAddedBlackList is a free log subscription operation binding the contract event 0x42e160154868087d6bfdc0ca23d96a1c1cfa32f1b72ba9ba27b69b98a0d819dc.
//
// Solidity: event AddedBlackList(address indexed _user)
func (_MyContract *MyContractFilterer) WatchAddedBlackList(opts *bind.WatchOpts, sink chan<- *MyContractAddedBlackList, _user []common.Address) (event.Subscription, error) {

	var _userRule []interface{}
	for _, _userItem := range _user {
		_userRule = append(_userRule, _userItem)
	}

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "AddedBlackList", _userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractAddedBlackList)
				if err := _MyContract.contract.UnpackLog(event, "AddedBlackList", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseAddedBlackList is a log parse operation binding the contract event 0x42e160154868087d6bfdc0ca23d96a1c1cfa32f1b72ba9ba27b69b98a0d819dc.
//
// Solidity: event AddedBlackList(address indexed _user)
func (_MyContract *MyContractFilterer) ParseAddedBlackList(log types.Log) (*MyContractAddedBlackList, error) {
	event := new(MyContractAddedBlackList)
	if err := _MyContract.contract.UnpackLog(event, "AddedBlackList", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractApprovalIterator is returned from FilterApproval and is used to iterate over the raw logs and unpacked data for Approval events raised by the MyContract contract.
type MyContractApprovalIterator struct {
	Event *MyContractApproval // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractApprovalIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractApproval)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractApproval)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractApprovalIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractApprovalIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractApproval represents a Approval event raised by the MyContract contract.
type MyContractApproval struct {
	Owner   common.Address
	Spender common.Address
	Value   *big.Int
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterApproval is a free log retrieval operation binding the contract event 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925.
//
// Solidity: event Approval(address indexed owner, address indexed spender, uint256 value)
func (_MyContract *MyContractFilterer) FilterApproval(opts *bind.FilterOpts, owner []common.Address, spender []common.Address) (*MyContractApprovalIterator, error) {

	var ownerRule []interface{}
	for _, ownerItem := range owner {
		ownerRule = append(ownerRule, ownerItem)
	}
	var spenderRule []interface{}
	for _, spenderItem := range spender {
		spenderRule = append(spenderRule, spenderItem)
	}

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "Approval", ownerRule, spenderRule)
	if err != nil {
		return nil, err
	}
	return &MyContractApprovalIterator{contract: _MyContract.contract, event: "Approval", logs: logs, sub: sub}, nil
}

// WatchApproval is a free log subscription operation binding the contract event 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925.
//
// Solidity: event Approval(address indexed owner, address indexed spender, uint256 value)
func (_MyContract *MyContractFilterer) WatchApproval(opts *bind.WatchOpts, sink chan<- *MyContractApproval, owner []common.Address, spender []common.Address) (event.Subscription, error) {

	var ownerRule []interface{}
	for _, ownerItem := range owner {
		ownerRule = append(ownerRule, ownerItem)
	}
	var spenderRule []interface{}
	for _, spenderItem := range spender {
		spenderRule = append(spenderRule, spenderItem)
	}

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "Approval", ownerRule, spenderRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractApproval)
				if err := _MyContract.contract.UnpackLog(event, "Approval", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseApproval is a log parse operation binding the contract event 0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925.
//
// Solidity: event Approval(address indexed owner, address indexed spender, uint256 value)
func (_MyContract *MyContractFilterer) ParseApproval(log types.Log) (*MyContractApproval, error) {
	event := new(MyContractApproval)
	if err := _MyContract.contract.UnpackLog(event, "Approval", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractDeprecateIterator is returned from FilterDeprecate and is used to iterate over the raw logs and unpacked data for Deprecate events raised by the MyContract contract.
type MyContractDeprecateIterator struct {
	Event *MyContractDeprecate // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractDeprecateIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractDeprecate)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractDeprecate)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractDeprecateIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractDeprecateIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractDeprecate represents a Deprecate event raised by the MyContract contract.
type MyContractDeprecate struct {
	NewAddress common.Address
	Raw        types.Log // Blockchain specific contextual infos
}

// FilterDeprecate is a free log retrieval operation binding the contract event 0xcc358699805e9a8b7f77b522628c7cb9abd07d9efb86b6fb616af1609036a99e.
//
// Solidity: event Deprecate(address newAddress)
func (_MyContract *MyContractFilterer) FilterDeprecate(opts *bind.FilterOpts) (*MyContractDeprecateIterator, error) {

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "Deprecate")
	if err != nil {
		return nil, err
	}
	return &MyContractDeprecateIterator{contract: _MyContract.contract, event: "Deprecate", logs: logs, sub: sub}, nil
}

// WatchDeprecate is a free log subscription operation binding the contract event 0xcc358699805e9a8b7f77b522628c7cb9abd07d9efb86b6fb616af1609036a99e.
//
// Solidity: event Deprecate(address newAddress)
func (_MyContract *MyContractFilterer) WatchDeprecate(opts *bind.WatchOpts, sink chan<- *MyContractDeprecate) (event.Subscription, error) {

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "Deprecate")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractDeprecate)
				if err := _MyContract.contract.UnpackLog(event, "Deprecate", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseDeprecate is a log parse operation binding the contract event 0xcc358699805e9a8b7f77b522628c7cb9abd07d9efb86b6fb616af1609036a99e.
//
// Solidity: event Deprecate(address newAddress)
func (_MyContract *MyContractFilterer) ParseDeprecate(log types.Log) (*MyContractDeprecate, error) {
	event := new(MyContractDeprecate)
	if err := _MyContract.contract.UnpackLog(event, "Deprecate", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractDestroyedBlackFundsIterator is returned from FilterDestroyedBlackFunds and is used to iterate over the raw logs and unpacked data for DestroyedBlackFunds events raised by the MyContract contract.
type MyContractDestroyedBlackFundsIterator struct {
	Event *MyContractDestroyedBlackFunds // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractDestroyedBlackFundsIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractDestroyedBlackFunds)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractDestroyedBlackFunds)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractDestroyedBlackFundsIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractDestroyedBlackFundsIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractDestroyedBlackFunds represents a DestroyedBlackFunds event raised by the MyContract contract.
type MyContractDestroyedBlackFunds struct {
	BlackListedUser common.Address
	Balance         *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterDestroyedBlackFunds is a free log retrieval operation binding the contract event 0x61e6e66b0d6339b2980aecc6ccc0039736791f0ccde9ed512e789a7fbdd698c6.
//
// Solidity: event DestroyedBlackFunds(address indexed _blackListedUser, uint256 _balance)
func (_MyContract *MyContractFilterer) FilterDestroyedBlackFunds(opts *bind.FilterOpts, _blackListedUser []common.Address) (*MyContractDestroyedBlackFundsIterator, error) {

	var _blackListedUserRule []interface{}
	for _, _blackListedUserItem := range _blackListedUser {
		_blackListedUserRule = append(_blackListedUserRule, _blackListedUserItem)
	}

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "DestroyedBlackFunds", _blackListedUserRule)
	if err != nil {
		return nil, err
	}
	return &MyContractDestroyedBlackFundsIterator{contract: _MyContract.contract, event: "DestroyedBlackFunds", logs: logs, sub: sub}, nil
}

// WatchDestroyedBlackFunds is a free log subscription operation binding the contract event 0x61e6e66b0d6339b2980aecc6ccc0039736791f0ccde9ed512e789a7fbdd698c6.
//
// Solidity: event DestroyedBlackFunds(address indexed _blackListedUser, uint256 _balance)
func (_MyContract *MyContractFilterer) WatchDestroyedBlackFunds(opts *bind.WatchOpts, sink chan<- *MyContractDestroyedBlackFunds, _blackListedUser []common.Address) (event.Subscription, error) {

	var _blackListedUserRule []interface{}
	for _, _blackListedUserItem := range _blackListedUser {
		_blackListedUserRule = append(_blackListedUserRule, _blackListedUserItem)
	}

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "DestroyedBlackFunds", _blackListedUserRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractDestroyedBlackFunds)
				if err := _MyContract.contract.UnpackLog(event, "DestroyedBlackFunds", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseDestroyedBlackFunds is a log parse operation binding the contract event 0x61e6e66b0d6339b2980aecc6ccc0039736791f0ccde9ed512e789a7fbdd698c6.
//
// Solidity: event DestroyedBlackFunds(address indexed _blackListedUser, uint256 _balance)
func (_MyContract *MyContractFilterer) ParseDestroyedBlackFunds(log types.Log) (*MyContractDestroyedBlackFunds, error) {
	event := new(MyContractDestroyedBlackFunds)
	if err := _MyContract.contract.UnpackLog(event, "DestroyedBlackFunds", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractIssueIterator is returned from FilterIssue and is used to iterate over the raw logs and unpacked data for Issue events raised by the MyContract contract.
type MyContractIssueIterator struct {
	Event *MyContractIssue // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractIssueIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractIssue)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractIssue)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractIssueIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractIssueIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractIssue represents a Issue event raised by the MyContract contract.
type MyContractIssue struct {
	Amount *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterIssue is a free log retrieval operation binding the contract event 0xcb8241adb0c3fdb35b70c24ce35c5eb0c17af7431c99f827d44a445ca624176a.
//
// Solidity: event Issue(uint256 amount)
func (_MyContract *MyContractFilterer) FilterIssue(opts *bind.FilterOpts) (*MyContractIssueIterator, error) {

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "Issue")
	if err != nil {
		return nil, err
	}
	return &MyContractIssueIterator{contract: _MyContract.contract, event: "Issue", logs: logs, sub: sub}, nil
}

// WatchIssue is a free log subscription operation binding the contract event 0xcb8241adb0c3fdb35b70c24ce35c5eb0c17af7431c99f827d44a445ca624176a.
//
// Solidity: event Issue(uint256 amount)
func (_MyContract *MyContractFilterer) WatchIssue(opts *bind.WatchOpts, sink chan<- *MyContractIssue) (event.Subscription, error) {

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "Issue")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractIssue)
				if err := _MyContract.contract.UnpackLog(event, "Issue", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseIssue is a log parse operation binding the contract event 0xcb8241adb0c3fdb35b70c24ce35c5eb0c17af7431c99f827d44a445ca624176a.
//
// Solidity: event Issue(uint256 amount)
func (_MyContract *MyContractFilterer) ParseIssue(log types.Log) (*MyContractIssue, error) {
	event := new(MyContractIssue)
	if err := _MyContract.contract.UnpackLog(event, "Issue", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractOwnershipTransferredIterator is returned from FilterOwnershipTransferred and is used to iterate over the raw logs and unpacked data for OwnershipTransferred events raised by the MyContract contract.
type MyContractOwnershipTransferredIterator struct {
	Event *MyContractOwnershipTransferred // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractOwnershipTransferredIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractOwnershipTransferred)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractOwnershipTransferred)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractOwnershipTransferredIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractOwnershipTransferredIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractOwnershipTransferred represents a OwnershipTransferred event raised by the MyContract contract.
type MyContractOwnershipTransferred struct {
	PreviousOwner common.Address
	NewOwner      common.Address
	Raw           types.Log // Blockchain specific contextual infos
}

// FilterOwnershipTransferred is a free log retrieval operation binding the contract event 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0.
//
// Solidity: event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
func (_MyContract *MyContractFilterer) FilterOwnershipTransferred(opts *bind.FilterOpts, previousOwner []common.Address, newOwner []common.Address) (*MyContractOwnershipTransferredIterator, error) {

	var previousOwnerRule []interface{}
	for _, previousOwnerItem := range previousOwner {
		previousOwnerRule = append(previousOwnerRule, previousOwnerItem)
	}
	var newOwnerRule []interface{}
	for _, newOwnerItem := range newOwner {
		newOwnerRule = append(newOwnerRule, newOwnerItem)
	}

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "OwnershipTransferred", previousOwnerRule, newOwnerRule)
	if err != nil {
		return nil, err
	}
	return &MyContractOwnershipTransferredIterator{contract: _MyContract.contract, event: "OwnershipTransferred", logs: logs, sub: sub}, nil
}

// WatchOwnershipTransferred is a free log subscription operation binding the contract event 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0.
//
// Solidity: event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
func (_MyContract *MyContractFilterer) WatchOwnershipTransferred(opts *bind.WatchOpts, sink chan<- *MyContractOwnershipTransferred, previousOwner []common.Address, newOwner []common.Address) (event.Subscription, error) {

	var previousOwnerRule []interface{}
	for _, previousOwnerItem := range previousOwner {
		previousOwnerRule = append(previousOwnerRule, previousOwnerItem)
	}
	var newOwnerRule []interface{}
	for _, newOwnerItem := range newOwner {
		newOwnerRule = append(newOwnerRule, newOwnerItem)
	}

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "OwnershipTransferred", previousOwnerRule, newOwnerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractOwnershipTransferred)
				if err := _MyContract.contract.UnpackLog(event, "OwnershipTransferred", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseOwnershipTransferred is a log parse operation binding the contract event 0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0.
//
// Solidity: event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
func (_MyContract *MyContractFilterer) ParseOwnershipTransferred(log types.Log) (*MyContractOwnershipTransferred, error) {
	event := new(MyContractOwnershipTransferred)
	if err := _MyContract.contract.UnpackLog(event, "OwnershipTransferred", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractParamsIterator is returned from FilterParams and is used to iterate over the raw logs and unpacked data for Params events raised by the MyContract contract.
type MyContractParamsIterator struct {
	Event *MyContractParams // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractParamsIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractParams)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractParams)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractParamsIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractParamsIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractParams represents a Params event raised by the MyContract contract.
type MyContractParams struct {
	FeeBasisPoints *big.Int
	MaxFee         *big.Int
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterParams is a free log retrieval operation binding the contract event 0xb044a1e409eac5c48e5af22d4af52670dd1a99059537a78b31b48c6500a6354e.
//
// Solidity: event Params(uint256 feeBasisPoints, uint256 maxFee)
func (_MyContract *MyContractFilterer) FilterParams(opts *bind.FilterOpts) (*MyContractParamsIterator, error) {

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "Params")
	if err != nil {
		return nil, err
	}
	return &MyContractParamsIterator{contract: _MyContract.contract, event: "Params", logs: logs, sub: sub}, nil
}

// WatchParams is a free log subscription operation binding the contract event 0xb044a1e409eac5c48e5af22d4af52670dd1a99059537a78b31b48c6500a6354e.
//
// Solidity: event Params(uint256 feeBasisPoints, uint256 maxFee)
func (_MyContract *MyContractFilterer) WatchParams(opts *bind.WatchOpts, sink chan<- *MyContractParams) (event.Subscription, error) {

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "Params")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractParams)
				if err := _MyContract.contract.UnpackLog(event, "Params", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseParams is a log parse operation binding the contract event 0xb044a1e409eac5c48e5af22d4af52670dd1a99059537a78b31b48c6500a6354e.
//
// Solidity: event Params(uint256 feeBasisPoints, uint256 maxFee)
func (_MyContract *MyContractFilterer) ParseParams(log types.Log) (*MyContractParams, error) {
	event := new(MyContractParams)
	if err := _MyContract.contract.UnpackLog(event, "Params", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractPauseIterator is returned from FilterPause and is used to iterate over the raw logs and unpacked data for Pause events raised by the MyContract contract.
type MyContractPauseIterator struct {
	Event *MyContractPause // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractPauseIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractPause)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractPause)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractPauseIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractPauseIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractPause represents a Pause event raised by the MyContract contract.
type MyContractPause struct {
	Raw types.Log // Blockchain specific contextual infos
}

// FilterPause is a free log retrieval operation binding the contract event 0x6985a02210a168e66602d3235cb6db0e70f92b3ba4d376a33c0f3d9434bff625.
//
// Solidity: event Pause()
func (_MyContract *MyContractFilterer) FilterPause(opts *bind.FilterOpts) (*MyContractPauseIterator, error) {

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "Pause")
	if err != nil {
		return nil, err
	}
	return &MyContractPauseIterator{contract: _MyContract.contract, event: "Pause", logs: logs, sub: sub}, nil
}

// WatchPause is a free log subscription operation binding the contract event 0x6985a02210a168e66602d3235cb6db0e70f92b3ba4d376a33c0f3d9434bff625.
//
// Solidity: event Pause()
func (_MyContract *MyContractFilterer) WatchPause(opts *bind.WatchOpts, sink chan<- *MyContractPause) (event.Subscription, error) {

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "Pause")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractPause)
				if err := _MyContract.contract.UnpackLog(event, "Pause", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParsePause is a log parse operation binding the contract event 0x6985a02210a168e66602d3235cb6db0e70f92b3ba4d376a33c0f3d9434bff625.
//
// Solidity: event Pause()
func (_MyContract *MyContractFilterer) ParsePause(log types.Log) (*MyContractPause, error) {
	event := new(MyContractPause)
	if err := _MyContract.contract.UnpackLog(event, "Pause", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractRedeemIterator is returned from FilterRedeem and is used to iterate over the raw logs and unpacked data for Redeem events raised by the MyContract contract.
type MyContractRedeemIterator struct {
	Event *MyContractRedeem // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractRedeemIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractRedeem)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractRedeem)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractRedeemIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractRedeemIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractRedeem represents a Redeem event raised by the MyContract contract.
type MyContractRedeem struct {
	Amount *big.Int
	Raw    types.Log // Blockchain specific contextual infos
}

// FilterRedeem is a free log retrieval operation binding the contract event 0x702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44.
//
// Solidity: event Redeem(uint256 amount)
func (_MyContract *MyContractFilterer) FilterRedeem(opts *bind.FilterOpts) (*MyContractRedeemIterator, error) {

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "Redeem")
	if err != nil {
		return nil, err
	}
	return &MyContractRedeemIterator{contract: _MyContract.contract, event: "Redeem", logs: logs, sub: sub}, nil
}

// WatchRedeem is a free log subscription operation binding the contract event 0x702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44.
//
// Solidity: event Redeem(uint256 amount)
func (_MyContract *MyContractFilterer) WatchRedeem(opts *bind.WatchOpts, sink chan<- *MyContractRedeem) (event.Subscription, error) {

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "Redeem")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractRedeem)
				if err := _MyContract.contract.UnpackLog(event, "Redeem", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseRedeem is a log parse operation binding the contract event 0x702d5967f45f6513a38ffc42d6ba9bf230bd40e8f53b16363c7eb4fd2deb9a44.
//
// Solidity: event Redeem(uint256 amount)
func (_MyContract *MyContractFilterer) ParseRedeem(log types.Log) (*MyContractRedeem, error) {
	event := new(MyContractRedeem)
	if err := _MyContract.contract.UnpackLog(event, "Redeem", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractRemovedBlackListIterator is returned from FilterRemovedBlackList and is used to iterate over the raw logs and unpacked data for RemovedBlackList events raised by the MyContract contract.
type MyContractRemovedBlackListIterator struct {
	Event *MyContractRemovedBlackList // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractRemovedBlackListIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractRemovedBlackList)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractRemovedBlackList)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractRemovedBlackListIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractRemovedBlackListIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractRemovedBlackList represents a RemovedBlackList event raised by the MyContract contract.
type MyContractRemovedBlackList struct {
	User common.Address
	Raw  types.Log // Blockchain specific contextual infos
}

// FilterRemovedBlackList is a free log retrieval operation binding the contract event 0xd7e9ec6e6ecd65492dce6bf513cd6867560d49544421d0783ddf06e76c24470c.
//
// Solidity: event RemovedBlackList(address indexed _user)
func (_MyContract *MyContractFilterer) FilterRemovedBlackList(opts *bind.FilterOpts, _user []common.Address) (*MyContractRemovedBlackListIterator, error) {

	var _userRule []interface{}
	for _, _userItem := range _user {
		_userRule = append(_userRule, _userItem)
	}

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "RemovedBlackList", _userRule)
	if err != nil {
		return nil, err
	}
	return &MyContractRemovedBlackListIterator{contract: _MyContract.contract, event: "RemovedBlackList", logs: logs, sub: sub}, nil
}

// WatchRemovedBlackList is a free log subscription operation binding the contract event 0xd7e9ec6e6ecd65492dce6bf513cd6867560d49544421d0783ddf06e76c24470c.
//
// Solidity: event RemovedBlackList(address indexed _user)
func (_MyContract *MyContractFilterer) WatchRemovedBlackList(opts *bind.WatchOpts, sink chan<- *MyContractRemovedBlackList, _user []common.Address) (event.Subscription, error) {

	var _userRule []interface{}
	for _, _userItem := range _user {
		_userRule = append(_userRule, _userItem)
	}

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "RemovedBlackList", _userRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractRemovedBlackList)
				if err := _MyContract.contract.UnpackLog(event, "RemovedBlackList", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseRemovedBlackList is a log parse operation binding the contract event 0xd7e9ec6e6ecd65492dce6bf513cd6867560d49544421d0783ddf06e76c24470c.
//
// Solidity: event RemovedBlackList(address indexed _user)
func (_MyContract *MyContractFilterer) ParseRemovedBlackList(log types.Log) (*MyContractRemovedBlackList, error) {
	event := new(MyContractRemovedBlackList)
	if err := _MyContract.contract.UnpackLog(event, "RemovedBlackList", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractTransferIterator is returned from FilterTransfer and is used to iterate over the raw logs and unpacked data for Transfer events raised by the MyContract contract.
type MyContractTransferIterator struct {
	Event *MyContractTransfer // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractTransferIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractTransfer)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractTransfer)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractTransferIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractTransferIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractTransfer represents a Transfer event raised by the MyContract contract.
type MyContractTransfer struct {
	From  common.Address
	To    common.Address
	Value *big.Int
	Raw   types.Log // Blockchain specific contextual infos
}

// FilterTransfer is a free log retrieval operation binding the contract event 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef.
//
// Solidity: event Transfer(address indexed from, address indexed to, uint256 value)
func (_MyContract *MyContractFilterer) FilterTransfer(opts *bind.FilterOpts, from []common.Address, to []common.Address) (*MyContractTransferIterator, error) {

	var fromRule []interface{}
	for _, fromItem := range from {
		fromRule = append(fromRule, fromItem)
	}
	var toRule []interface{}
	for _, toItem := range to {
		toRule = append(toRule, toItem)
	}

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "Transfer", fromRule, toRule)
	if err != nil {
		return nil, err
	}
	return &MyContractTransferIterator{contract: _MyContract.contract, event: "Transfer", logs: logs, sub: sub}, nil
}

// WatchTransfer is a free log subscription operation binding the contract event 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef.
//
// Solidity: event Transfer(address indexed from, address indexed to, uint256 value)
func (_MyContract *MyContractFilterer) WatchTransfer(opts *bind.WatchOpts, sink chan<- *MyContractTransfer, from []common.Address, to []common.Address) (event.Subscription, error) {

	var fromRule []interface{}
	for _, fromItem := range from {
		fromRule = append(fromRule, fromItem)
	}
	var toRule []interface{}
	for _, toItem := range to {
		toRule = append(toRule, toItem)
	}

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "Transfer", fromRule, toRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractTransfer)
				if err := _MyContract.contract.UnpackLog(event, "Transfer", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseTransfer is a log parse operation binding the contract event 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef.
//
// Solidity: event Transfer(address indexed from, address indexed to, uint256 value)
func (_MyContract *MyContractFilterer) ParseTransfer(log types.Log) (*MyContractTransfer, error) {
	event := new(MyContractTransfer)
	if err := _MyContract.contract.UnpackLog(event, "Transfer", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// MyContractUnpauseIterator is returned from FilterUnpause and is used to iterate over the raw logs and unpacked data for Unpause events raised by the MyContract contract.
type MyContractUnpauseIterator struct {
	Event *MyContractUnpause // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *MyContractUnpauseIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(MyContractUnpause)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(MyContractUnpause)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *MyContractUnpauseIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *MyContractUnpauseIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// MyContractUnpause represents a Unpause event raised by the MyContract contract.
type MyContractUnpause struct {
	Raw types.Log // Blockchain specific contextual infos
}

// FilterUnpause is a free log retrieval operation binding the contract event 0x7805862f689e2f13df9f062ff482ad3ad112aca9e0847911ed832e158c525b33.
//
// Solidity: event Unpause()
func (_MyContract *MyContractFilterer) FilterUnpause(opts *bind.FilterOpts) (*MyContractUnpauseIterator, error) {

	logs, sub, err := _MyContract.contract.FilterLogs(opts, "Unpause")
	if err != nil {
		return nil, err
	}
	return &MyContractUnpauseIterator{contract: _MyContract.contract, event: "Unpause", logs: logs, sub: sub}, nil
}

// WatchUnpause is a free log subscription operation binding the contract event 0x7805862f689e2f13df9f062ff482ad3ad112aca9e0847911ed832e158c525b33.
//
// Solidity: event Unpause()
func (_MyContract *MyContractFilterer) WatchUnpause(opts *bind.WatchOpts, sink chan<- *MyContractUnpause) (event.Subscription, error) {

	logs, sub, err := _MyContract.contract.WatchLogs(opts, "Unpause")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(MyContractUnpause)
				if err := _MyContract.contract.UnpackLog(event, "Unpause", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseUnpause is a log parse operation binding the contract event 0x7805862f689e2f13df9f062ff482ad3ad112aca9e0847911ed832e158c525b33.
//
// Solidity: event Unpause()
func (_MyContract *MyContractFilterer) ParseUnpause(log types.Log) (*MyContractUnpause, error) {
	event := new(MyContractUnpause)
	if err := _MyContract.contract.UnpackLog(event, "Unpause", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
