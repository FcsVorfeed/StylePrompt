import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 所有测试产物位于被忽略的 private/build 内，不产生真实资料或凭证。
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'private/build/site');

test('重复构建清除旧文件，只发布当前网页允许列表', async () => {
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'stale-test-file.txt'), 'SYNTHETIC STALE FILE');
  execFileSync(process.execPath, ['scripts/BuildSystem/build.mjs'], { cwd: root });
  await assert.rejects(access(resolve(output, 'stale-test-file.txt')));

  const files = await readdir(output, { recursive: true });

  assert.ok(!files.some(file => /tests|browser-fixture|\.git|\.svn|qa/.test(file)));

  for (const file of files.filter(file => /\.(js|html|json|css)$/.test(file))) {
    assert.doesNotMatch(await readFile(resolve(output, file), 'utf8'), /TEST_ONLY|qa-catalog|本地交互验收/);
  }
});
