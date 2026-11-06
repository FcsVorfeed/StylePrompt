import { cp, mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GetRepository } from '../../src/GitHubSystem/catalog.js';

// 构建采用显式允许列表；绝不把 private 资料或整个工作区打包进网站。
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, 'private/build/site');
let repository = process.env.GITHUB_REPOSITORY || '';

if (!repository) {
  try {
    const config = JSON.parse(await readFile(resolve(root, 'private/config/site.json'), 'utf8'));

    repository = config.repository || '';
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

if (repository) GetRepository(repository);

// 拒绝符号链接目录后重建固定产物目录，保证旧文件不会混入新发布。
for (const directory of ['private', 'private/build', 'private/build/site']) {
  const target = resolve(root, directory);

  try {
    if ((await lstat(target)).isSymbolicLink()) throw new Error('构建目录不能是符号链接。');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

if (output !== resolve(root, 'private', 'build', 'site')) throw new Error('构建目录越界。');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'index.html'), resolve(output, 'index.html'));
await cp(resolve(root, 'src'), resolve(output, 'src'), { recursive: true });
await writeFile(resolve(output, 'runtime-config.json'), JSON.stringify({ repository }, null, 2) + '\n');
await writeFile(resolve(output, '.nojekyll'), '');

console.log('已构建到 private/build/site；配置仅包含公开仓库标识。');
