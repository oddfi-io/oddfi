/**
 * 全 ABI 方法控制台。
 *
 * 用法:
 *   npx tsx script/method.ts list <Contract>
 *   npx tsx script/method.ts read <Contract> <method|signature> '[argsJson]'
 *   npx tsx script/method.ts write <Contract> <method|signature> '[argsJson]' [valueBNB]
 *
 * Contract:
 *   ODDToken | StakingPool | LiquidityPool | BettingPool | BettingBetModule | BettingMarketModule | BettingReferralModule | BettingSettlementModule | BettingParlayModule | BettingParlayLens | TierSale | HouseVault | DexLaunchController | DexLpLocker | EcosystemRewards
 *
 * 参数规则:
 *   - argsJson 是 JSON 数组，例如 '["0xabc..."]'
 *   - uint/int 可以用字符串，避免 JS number 精度问题，例如 '["1000000000000000000"]'
 *   - tuple 可以用数组或对象；对象 key 使用 ABI input name
 *   - bytes32 若传非 0x...64 长度字符串，会自动 keccak256(text)
 */
import {
  decodeFunctionResult,
  encodeFunctionData,
  parseEther,
  type Abi,
  type AbiFunction,
  type AbiParameter,
  type Address,
  type Hex,
} from 'viem';
import {
  getContractSpec,
  jsonStringify,
  parseBytes32,
  publicClient,
  requireWalletClient,
  waitForTx,
  ZERO_ADDRESS,
} from './config.js';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type AbiParameterWithComponents = AbiParameter & { components?: readonly AbiParameterWithComponents[] };

const [action, contractAlias, method, argsJson = '[]', valueArg] = process.argv.slice(2);

if (!action || !contractAlias) {
  usage();
  process.exit(1);
}

const spec = getContractSpec(contractAlias);
if (action !== 'list' && spec.address === ZERO_ADDRESS) {
  throw new Error(`${contractAlias} 尚未配置地址；请先设置对应 *_ADDRESS。模块类业务写入口仍应优先通过 BettingPool proxy 调用。`);
}
const functions = (spec.abi as Abi).filter((item): item is AbiFunction => item.type === 'function');

if (action === 'list') {
  for (const fn of functions) {
    const mutability = fn.stateMutability || 'nonpayable';
    const inputs = fn.inputs.map((input) => `${input.type}${input.name ? ` ${input.name}` : ''}`).join(', ');
    const outputs = fn.outputs?.map((output) => output.type).join(', ') || '';
    console.log(`${mutability.padEnd(10)} ${fn.name}(${inputs})${outputs ? ` returns (${outputs})` : ''}`);
  }
  process.exit(0);
}

if (!method) {
  usage();
  process.exit(1);
}

const fn = findFunction(functions, method);
const rawArgs = parseArgsJson(argsJson);
const args = coerceArgs(fn.inputs, rawArgs);
const abi = [fn] as Abi;

if (action === 'read') {
  if (fn.stateMutability !== 'view' && fn.stateMutability !== 'pure') {
    throw new Error(`${fn.name} 不是 view/pure 方法；如需发送交易请用 write`);
  }
  const data = encodeFunctionData({ abi, functionName: fn.name, args });
  const result = await publicClient.call({ to: spec.address as Address, data });
  if (!result.data || result.data === '0x') {
    console.log('null');
  } else {
    const decoded = decodeFunctionResult({ abi, functionName: fn.name, data: result.data });
    console.log(jsonStringify(decoded));
  }
} else if (action === 'write') {
  if (fn.stateMutability === 'view' || fn.stateMutability === 'pure') {
    throw new Error(`${fn.name} 是 view/pure 方法；请用 read`);
  }
  const walletClient = requireWalletClient();
  const data = encodeFunctionData({ abi, functionName: fn.name, args });
  const value = valueArg ? parseEther(valueArg) : undefined;
  const hash = await walletClient.sendTransaction({
    to: spec.address as Address,
    data,
    value,
  });
  await waitForTx(hash);
} else {
  usage();
  process.exit(1);
}

function usage() {
  console.error([
    '用法:',
    '  npx tsx script/method.ts list <Contract>',
    "  npx tsx script/method.ts read <Contract> <method|signature> '[argsJson]'",
    "  npx tsx script/method.ts write <Contract> <method|signature> '[argsJson]' [valueBNB]",
  ].join('\n'));
}

function parseArgsJson(input: string): JsonValue[] {
  const parsed = JSON.parse(input) as JsonValue;
  if (!Array.isArray(parsed)) {
    throw new Error('argsJson 必须是 JSON 数组');
  }
  return parsed;
}

function findFunction(items: AbiFunction[], selector: string): AbiFunction {
  if (selector.includes('(')) {
    const matched = items.find((item) => signatureOf(item) === selector);
    if (!matched) throw new Error(`找不到方法签名: ${selector}`);
    return matched;
  }

  const matched = items.filter((item) => item.name === selector);
  if (matched.length === 0) throw new Error(`找不到方法: ${selector}`);
  if (matched.length > 1) {
    throw new Error(`方法 ${selector} 有重载，请使用完整签名:\n${matched.map(signatureOf).join('\n')}`);
  }
  return matched[0];
}

function signatureOf(fn: AbiFunction): string {
  return `${fn.name}(${fn.inputs.map((input) => canonicalType(input)).join(',')})`;
}

function canonicalType(param: AbiParameter): string {
  if (param.type.startsWith('tuple')) {
    const tupleParam = param as AbiParameterWithComponents;
    const suffix = param.type.slice('tuple'.length);
    return `(${(tupleParam.components || []).map((component) => canonicalType(component)).join(',')})${suffix}`;
  }
  return param.type;
}

function coerceArgs(params: readonly AbiParameter[], values: JsonValue[]): unknown[] {
  if (params.length !== values.length) {
    throw new Error(`参数数量不匹配: ABI 需要 ${params.length} 个，收到 ${values.length} 个`);
  }
  return params.map((param, index) => coerceValue(param, values[index]));
}

function coerceValue(param: AbiParameter, value: JsonValue): unknown {
  if (param.type.endsWith('[]')) {
    if (!Array.isArray(value)) throw new Error(`${param.name || param.type} 需要数组`);
    const itemParam = { ...param, type: param.type.slice(0, -2) } as AbiParameter;
    return value.map((item) => coerceValue(itemParam, item));
  }

  if (param.type.startsWith('tuple')) {
    const tupleParam = param as AbiParameterWithComponents;
    const components = tupleParam.components || [];
    if (Array.isArray(value)) return coerceArgs(components, value);
    if (value && typeof value === 'object') {
      return components.map((component) => {
        if (!component.name) throw new Error(`tuple component 缺少 name，无法使用对象参数`);
        return coerceValue(component, value[component.name]);
      });
    }
    throw new Error(`${param.name || param.type} 需要 tuple 数组或对象`);
  }

  if (param.type.startsWith('uint') || param.type.startsWith('int')) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`${param.name || param.type} 需要数字或数字字符串`);
    }
    return BigInt(value);
  }

  if (param.type === 'bool') {
    if (typeof value !== 'boolean') throw new Error(`${param.name || param.type} 需要 boolean`);
    return value;
  }

  if (param.type === 'address') {
    if (typeof value !== 'string') throw new Error(`${param.name || param.type} 需要 address 字符串`);
    return value as Address;
  }

  if (param.type === 'bytes32') {
    if (typeof value !== 'string') throw new Error(`${param.name || param.type} 需要 bytes32 字符串`);
    return parseBytes32(value);
  }

  if (param.type.startsWith('bytes')) {
    if (typeof value !== 'string' || !value.startsWith('0x')) {
      throw new Error(`${param.name || param.type} 需要 hex bytes`);
    }
    return value as Hex;
  }

  if (param.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${param.name || param.type} 需要 string`);
    return value;
  }

  return value;
}
