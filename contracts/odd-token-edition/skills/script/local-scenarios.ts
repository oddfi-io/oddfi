/**
 * 本地 Foundry 场景矩阵入口。
 *
 * 用法:
 *   npx tsx script/local-scenarios.ts
 *
 * 该脚本从 skills/ 目录向上定位 Foundry 项目根目录，执行当前 fork-free 场景验收。
 * 复制 skills/ 目录到其它位置后，只有当父级目录仍包含 foundry.toml 时才可使用本地场景入口。
 */
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

if (!existsSync(resolve(repoRoot, 'foundry.toml'))) {
  throw new Error(`未找到 Foundry 项目根目录: ${repoRoot}`);
}

const commands: [string, string[]][] = [
  ['forge', ['test', '--match-path', 'test/LocalScenarioMatrix.t.sol', '--offline', '-vv']],
  ['forge', ['test', '--match-path', 'test/BatchMarketSettlement.t.sol', '--offline', '-vv']],
  ['forge', ['test', '--offline', '--no-match-path', 'test/Fork*', '-vv']],
];

for (const [cmd, args] of commands) {
  await run(cmd, args);
}

async function run(cmd: string, args: string[]) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}
