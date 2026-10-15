# 测试方法 → 被测方法 映射

> 跑 `go test ./...` 全绿。
> 每个测试都直接对应 `sdk/` 中某个或某组方法/类型。
> 业务适配层(原 `service/`)已剥离,本文档只收录 SDK 测试。

## 速览

| 包 | 主要被测对象 |
|---|---|
| `sdk/admin` | `admin.New`、枚举 `String()`、`LockParlayArgs.validate`、ABI 元 |
| `sdk/client` | `NewConnection`、`Env.String`、错误格式、RPC 脱敏 |
| `sdk/config` | `config.Load` |
| `sdk/errs` | `errs.Wrap`、`*ContractError`、`abiParser.ParseError` |
| `sdk/fixtures` | `LoadPinnedBlocks` |
| `sdk/multisig` | `multisig.New`、ABI、Calldata 打包、`SafeTx.SafeTxHash` / `PackExecTransaction`、`Handle.Propose/Execute` |
| `sdk/multisig/safetx` | `safetx.Client.Propose/Get`、`EncodeData`、URL 规整 |
| `sdk/reader` | `reader.New`、`EventKind.String`、`AllEventKinds`、`Topic0For`、`decodeLog`、`Stream` |
| `sdk/signer` | `NewFromHex/NewFromSecretFile/NewFromKeystoreFile/NewAuto`、`Signer.SignTx/SignHash`、`redactAddr` |

---

## sdk/admin (admin_test.go)

| 测试函数 | 被测方法 / 对象 | 验证点 |
|---|---|---|
| `TestNew_NilConn` | `admin.New(nil, ...)` | nil Connection 必须报错 |
| `TestEnums_String` | `MarketType.String() / SignalColor.String()` | 三种合法值 + 越界值的 fallback |
| `TestMarketTypesToUint8` | `marketTypesToUint8` (内部) | 切片转换正确 |
| `TestLockParlayArgs_Validate` | `LockParlayArgs.validate()` (内部) | leg ≥ 2、所有切片等长 |
| `TestTransactOpts_NoSigner` | `Client.transactOpts` (内部) | 无 signer 时返回 `ErrNoSigner` |
| `TestClient_AddressZeroWithoutSigner` | `Client.Address()` | 无 signer 时返回零地址 |
| `TestParsedABIHasAllAdminMethods` | abigen `BettingPoolMetaData.GetAbi()` 一致性 | 11 个 admin 方法都在 ABI 中 + 关键方法 arity 匹配 |

## sdk/client (connection_test.go)

| 测试函数 | 被测方法 / 对象 | 验证点 |
|---|---|---|
| `TestNewConnection_RPCRequired` | `NewConnection` | 空 RPC → `ErrRPCRequired` |
| `TestEnvString` | `Env.String()` | `Testnet` → `"testnet"`,`Mainnet` → `"mainnet"`,越界 fallback |
| `TestRedactRPC` | `redactRPC` (内部) | URL 中 path/query 隐去,只保留 scheme + host |
| `TestErrChainIDMismatch_Message` | `*ErrChainIDMismatch.Error()` | 含两边 chainID |
| `TestErrRoleMismatch_Message` | `*ErrRoleMismatch.Error()` | 含 role / want / got |

## sdk/config (config_test.go)

| 测试函数 | 被测方法 / 对象 | 验证点 |
|---|---|---|
| `TestLoadTestnet` | `Load("testnet")` | 解析成功 + 关键字段非零 |
| `TestLoadMainnet` | `Load("mainnet")` | 解析成功 + chainID = 56 |
| `TestLoadUnknown` | `Load("???")` | 未知环境名 → error |

## sdk/errs (errs_test.go)

| 测试函数 | 被测方法 / 对象 | 验证点 |
|---|---|---|
| `TestWrap_NilPassthrough` | `Wrap(nil, ...)` | nil 入参直接返回 nil |
| `TestWrap_PlainErrorWithoutData` | `Wrap` | 非 RPC error(无 ErrorData)原样返回 |
| `TestWrap_ErrorString` | `*ContractError.Error()` | 字符串包含 method 与 Name |
| `TestWrap_PanicUint` | `Wrap` | 即使 ErrorData 是奇怪类型也不 panic |
| `TestWrap_TypedABIError` | `Wrap` + `NewABIParser` | revert selector 能被解析为 typed error,字段填进 `Args` |
| `TestWrap_UnknownSelector` | `Wrap` | 不在 ABI 里的 selector → 普通 error,带 selector 前缀 |
| `TestExtractRevertData_NestedDataMap` | `extractRevertData` (内部) | 处理嵌套 `data` map 的兼容形态 |
| `TestContractError_IsByName` | `*ContractError.Is` | 同名 sentinel 按 Name 比对成功 |
| `TestParseError_BadSelector` | `abiParser.ParseError` | 输入太短 → `ok=false` |

## sdk/fixtures (fixtures_test.go)

| 测试函数 | 被测方法 / 对象 | 验证点 |
|---|---|---|
| `TestLoadPinnedBlocks` | `LoadPinnedBlocks` | testnet/mainnet 块号都非零 |

## sdk/multisig (multisig_test.go)

| 测试函数 | 被测方法 / 对象 | 验证点 |
|---|---|---|
| `TestNew_NilConn` | `multisig.New(nil, ...)` | 必须报错 |
| `TestParsedABIHasAllMultisigMethods` | abigen ABI 一致性 | 14 个 multisig 方法都在 ABI 且 arity 正确 |
| `TestCalldataPacking_Pause` | `packCalldata`(经 `Handle.Calldata` 间接) | `pause` 选项编码 = 仅 4 字节 selector |
| `TestCalldataPacking_SetAdmin` | 同上 | `setAdmin(address)` 32 字节 padded |
| `TestSafeTxHash_Deterministic` | `*SafeTx.SafeTxHash` | 同输入同输出、改 chainID/safe/data 必变 |
| `TestStructHash_DataIsHashed` | `SafeTx.structHash`(内部) | data 不同 hash 必不同 |
| `TestPackExecTransaction_RoundTrip` | `*SafeTx.PackExecTransaction` | selector + Inputs.Unpack 还原各字段 |
| `TestModeNotConfiguredErr_Strings` | `*ErrModeNotConfigured.Error()` | 各 mode 字符串非空 |
| `TestPropose_NotConfigured` | `*Handle.Propose` | 缺 Proposer/URL → `ErrModeNotConfigured` |
| `TestExecute_NotConfigured` | `*Handle.Execute` | 缺 SafeOwner / DirectExecute → `ErrModeNotConfigured` |
| `TestMarketTypeString` | `MarketType.String()` | 三值 + fallback |
| `TestDomainTypeHash` | `domainTypeHash`(包级常量) | 与 Safe v1.3 公布值一致 |
| `TestSafeTxTypeHash` | `safeTxTypeHash`(包级常量) | 与 Safe v1.3 公布值一致 |
| `TestSafeABIHasMethods` | `safeABI.Methods`(包级解析) | `nonce/getThreshold/execTransaction` 存在,`execTransaction` selector 4 字节 |

## sdk/multisig/safetx (client_test.go)

| 测试函数 | 被测方法 / 对象 | 验证点 |
|---|---|---|
| `TestPropose_Happy` | `*Client.Propose` | POST 路径、body 编码、返回 hash |
| `TestPropose_ServiceError` | `*Client.Propose` | 4xx → `*ErrServiceRejected` |
| `TestGet_Happy` | `*Client.Get` | GET 路径、解析 ConfirmationsRequired/Confirmations |
| `TestGet_NotFound` | `*Client.Get` | 404 → `ErrProposalNotFound` |
| `TestNew_StripsTrailingSlash` | `safetx.New` | baseURL 去尾 `/` |
| `TestEncodeData` | `EncodeData` | 空 → `"0x"`,非空 → `"0x..."` |

## sdk/reader (reader_test.go)

| 测试函数 | 被测方法 / 对象 | 验证点 |
|---|---|---|
| `TestNew_NilConn` | `reader.New` | nil → 报错 |
| `TestEventKind_String` | `EventKind.String()` | 已知 kind 与 fallback |
| `TestAllEventKinds` | `AllEventKinds()` | 至少 30 项 + 包含 `EventDeposited` |
| `TestDecoderRegistryComplete` | `decoderTable / kindToSolidityName / allTopics0`(内部) | name 一致 + size 对齐 |
| `TestTopic0For` | `Topic0For(kind)` | 已知 kind → 非零 hash + ok;未知 → `ok=false` |
| `TestTopic0For_DepositedSelector` | `Topic0For(EventDeposited)` | 等于 `keccak256("Deposited(address,uint256,bytes32)")` |
| `TestTopicsForKinds` | `topicsForKinds`(内部) | 空入参 → 全集;指定 kinds → 去重;未知 → 静默丢弃 |
| `TestDecodeLog_Deposited` | `decodeLog`(内部) | 真实 log → 解析为 `EventDeposited` payload |
| `TestDecodeLog_UnknownTopic` | `decodeLog` | 未知 topic0 → `EventUnknown` + `Decoded=nil` |
| `TestDecodeLog_NoTopics` | `decodeLog` | 空 topics → 错误 |
| `TestEventStream_Cancel` | `*EventStream.Cancel()` | Cancel 后 Events 通道关闭、不再读到日志 |
| `TestStreamOptsDefaults` | `StreamOpts` 默认值(经 `Stream` 内部) | PageSize/PollInterval/Confirms 缺省时填默认值 |

## sdk/signer (signer_test.go)

| 测试函数 | 被测方法 / 对象 | 验证点 |
|---|---|---|
| `TestNewFromHex_OK` | `NewFromHex` | 合法 hex → Signer 可签 |
| `TestNewFromHex_Empty` | `NewFromHex` | 空 → `ErrEmptyKeyMaterial` |
| `TestNewFromHex_Invalid` | `NewFromHex` | 非法 hex → 报错 |
| `TestNewFromSecretFile_OK` | `NewFromSecretFile` | 读取文件成功 |
| `TestNewFromSecretFile_Empty` | `NewFromSecretFile` | 空文件 → 报错 |
| `TestNewFromSecretFile_NotExist` | `NewFromSecretFile` | 文件不存在 → 报错 |
| `TestSignTx` | `Signer.SignTx` | 签名后 ChainID 与 sender 正确 |
| `TestSignTx_NoChainID` | `Signer.SignTx` | nil chainID → 报错 |
| `TestSignHash` | `Signer.SignHash` | 65 字节签名,可被 ecrecover 还原 |
| `TestNewAuto_Testnet_EnvWins` | `NewAuto` | 非 mainnet 时 env 优先 |
| `TestNewAuto_Testnet_FileFallback` | `NewAuto` | env 缺失 → file 回落 |
| `TestNewAuto_Mainnet_EnvForbidden` | `NewAuto` | mainnet 即使 env 有也不允许 |
| `TestNewAuto_Mainnet_FileOK` | `NewAuto` | mainnet 必须用文件 |
| `TestNewAuto_NilEnv` | `NewAuto(nil, ...)` | nil 检查器 → 报错 |
| `TestNewAuto_MissingOpts` | `NewAuto` | EnvVar/FilePath 都为空 → 报错 |
| `TestRedactAddr` | `redactAddr`(内部 / 日志用) | 0xABC...XYZ 形式截断 |
| `TestNewFromKeystoreFile_BadInput` | `NewFromKeystoreFile` | 不存在 / 错口令 → 报错 |

---

## 不在测试范围 (per-package 备注)

下列代码路径在 fork / E2E 测试中验证(`make test-fork`、`make test-e2e`),不属于 `go test ./...` 的覆盖:

- `Connection` 启动时的 `chainID` / `admin` / `multisig` 一致性校验:需要真实 RPC,见 fork 测试。
- `admin.LockBet/...` 的真正 broadcast / receipt 路径:同上。
- `multisig.Handle.Execute/Propose` 真正经过 Safe Transaction Service:E2E。

---

## 怎么定位

- 想看 **某个生产方法** 是否被测、被怎么测?用上面表中的"被测方法"列反查。
- 想看 **某个测试名** 在测什么?用左列即可。
- 测试文件位置:每个测试函数都和它测的源文件在同包内,文件名 `<pkg>_test.go`(例如 `sdk/multisig/safetx/client_test.go`)。
