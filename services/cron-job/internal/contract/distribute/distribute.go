// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package distribute

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

// DisMetaData contains all meta data concerning the Dis contract.
var DisMetaData = &bind.MetaData{
	ABI: "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"token\",\"type\":\"address\"},{\"internalType\":\"address[]\",\"name\":\"recipients\",\"type\":\"address[]\"},{\"internalType\":\"uint256[]\",\"name\":\"amounts\",\"type\":\"uint256[]\"}],\"name\":\"batchDistribute\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"newOwner\",\"type\":\"address\"}],\"name\":\"transferOwnership\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"inputs\":[],\"name\":\"owner\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"}]",
}

// DisABI is the input ABI used to generate the binding from.
// Deprecated: Use DisMetaData.ABI instead.
var DisABI = DisMetaData.ABI

// Dis is an auto generated Go binding around an Ethereum contract.
type Dis struct {
	DisCaller     // Read-only binding to the contract
	DisTransactor // Write-only binding to the contract
	DisFilterer   // Log filterer for contract events
}

// DisCaller is an auto generated read-only Go binding around an Ethereum contract.
type DisCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// DisTransactor is an auto generated write-only Go binding around an Ethereum contract.
type DisTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// DisFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type DisFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// DisSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type DisSession struct {
	Contract     *Dis              // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// DisCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type DisCallerSession struct {
	Contract *DisCaller    // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts // Call options to use throughout this session
}

// DisTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type DisTransactorSession struct {
	Contract     *DisTransactor    // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// DisRaw is an auto generated low-level Go binding around an Ethereum contract.
type DisRaw struct {
	Contract *Dis // Generic contract binding to access the raw methods on
}

// DisCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type DisCallerRaw struct {
	Contract *DisCaller // Generic read-only contract binding to access the raw methods on
}

// DisTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type DisTransactorRaw struct {
	Contract *DisTransactor // Generic write-only contract binding to access the raw methods on
}

// NewDis creates a new instance of Dis, bound to a specific deployed contract.
func NewDis(address common.Address, backend bind.ContractBackend) (*Dis, error) {
	contract, err := bindDis(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Dis{DisCaller: DisCaller{contract: contract}, DisTransactor: DisTransactor{contract: contract}, DisFilterer: DisFilterer{contract: contract}}, nil
}

// NewDisCaller creates a new read-only instance of Dis, bound to a specific deployed contract.
func NewDisCaller(address common.Address, caller bind.ContractCaller) (*DisCaller, error) {
	contract, err := bindDis(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &DisCaller{contract: contract}, nil
}

// NewDisTransactor creates a new write-only instance of Dis, bound to a specific deployed contract.
func NewDisTransactor(address common.Address, transactor bind.ContractTransactor) (*DisTransactor, error) {
	contract, err := bindDis(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &DisTransactor{contract: contract}, nil
}

// NewDisFilterer creates a new log filterer instance of Dis, bound to a specific deployed contract.
func NewDisFilterer(address common.Address, filterer bind.ContractFilterer) (*DisFilterer, error) {
	contract, err := bindDis(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &DisFilterer{contract: contract}, nil
}

// bindDis binds a generic wrapper to an already deployed contract.
func bindDis(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := DisMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Dis *DisRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Dis.Contract.DisCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Dis *DisRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Dis.Contract.DisTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Dis *DisRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Dis.Contract.DisTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Dis *DisCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Dis.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Dis *DisTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Dis.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Dis *DisTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Dis.Contract.contract.Transact(opts, method, params...)
}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (_Dis *DisCaller) Owner(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _Dis.contract.Call(opts, &out, "owner")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (_Dis *DisSession) Owner() (common.Address, error) {
	return _Dis.Contract.Owner(&_Dis.CallOpts)
}

// Owner is a free data retrieval call binding the contract method 0x8da5cb5b.
//
// Solidity: function owner() view returns(address)
func (_Dis *DisCallerSession) Owner() (common.Address, error) {
	return _Dis.Contract.Owner(&_Dis.CallOpts)
}

// BatchDistribute is a paid mutator transaction binding the contract method 0x9745a8fb.
//
// Solidity: function batchDistribute(address token, address[] recipients, uint256[] amounts) returns()
func (_Dis *DisTransactor) BatchDistribute(opts *bind.TransactOpts, token common.Address, recipients []common.Address, amounts []*big.Int) (*types.Transaction, error) {
	return _Dis.contract.Transact(opts, "batchDistribute", token, recipients, amounts)
}

// BatchDistribute is a paid mutator transaction binding the contract method 0x9745a8fb.
//
// Solidity: function batchDistribute(address token, address[] recipients, uint256[] amounts) returns()
func (_Dis *DisSession) BatchDistribute(token common.Address, recipients []common.Address, amounts []*big.Int) (*types.Transaction, error) {
	return _Dis.Contract.BatchDistribute(&_Dis.TransactOpts, token, recipients, amounts)
}

// BatchDistribute is a paid mutator transaction binding the contract method 0x9745a8fb.
//
// Solidity: function batchDistribute(address token, address[] recipients, uint256[] amounts) returns()
func (_Dis *DisTransactorSession) BatchDistribute(token common.Address, recipients []common.Address, amounts []*big.Int) (*types.Transaction, error) {
	return _Dis.Contract.BatchDistribute(&_Dis.TransactOpts, token, recipients, amounts)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_Dis *DisTransactor) TransferOwnership(opts *bind.TransactOpts, newOwner common.Address) (*types.Transaction, error) {
	return _Dis.contract.Transact(opts, "transferOwnership", newOwner)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_Dis *DisSession) TransferOwnership(newOwner common.Address) (*types.Transaction, error) {
	return _Dis.Contract.TransferOwnership(&_Dis.TransactOpts, newOwner)
}

// TransferOwnership is a paid mutator transaction binding the contract method 0xf2fde38b.
//
// Solidity: function transferOwnership(address newOwner) returns()
func (_Dis *DisTransactorSession) TransferOwnership(newOwner common.Address) (*types.Transaction, error) {
	return _Dis.Contract.TransferOwnership(&_Dis.TransactOpts, newOwner)
}
