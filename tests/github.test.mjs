import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GitHubStore } from '../src/GitHubSystem/github.js';
import { GetCatalog, GetMergedCatalog, GetRepository } from '../src/GitHubSystem/catalog.js';

// 测试数据全部为公开占位，不包含真实账号或凭证。
const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const firstEntry = { id: firstId, prompt: '第一行\n\n  second line', images: [{ path: `images/${firstId}.png`, width: 320, height: 480 }] };
const secondEntry = { id: secondId, prompt: '另一组', images: [{ path: `images/${secondId}.jpg`, width: 640, height: 480 }] };

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 构造受控 API，记录操作顺序但不发送任何网络请求。
function GetMock(context, catalog, options = {}) {
  const calls = [];

  context.mock.method(globalThis, 'fetch', async (url, init) => {
    const path = new URL(url).pathname.replace('/repos/OWNER/REPOSITORY', '');
    const body = init.body ? JSON.parse(init.body) : null;

    calls.push({ path, method: init.method, body, headers: init.headers });

    let value = {};
    let status = 200;

    if (path === '') value = { private: Boolean(options.private), permissions: { push: true } };
    else if (path === '/git/ref/heads/gallery-data') {
      value = { object: { sha: 'old-commit' } };
      if (options.empty) status = 404;
    } else if (path === '/git/commits/old-commit') value = { tree: { sha: 'old-tree' } };
    else if (path === '/contents/catalog.json') value = { encoding: 'base64', content: Buffer.from(JSON.stringify(catalog)).toString('base64') };
    else if (path === '/git/blobs') {
      value = { sha: 'new-image' };
      if (options.uploadFails) status = 403;
    } else if (path === '/git/trees') value = { sha: 'new-tree' };
    else if (path === '/git/commits') value = { sha: 'new-commit' };
    else if (path.startsWith('/git/refs')) {
      if (options.conflict) status = 422;
    } else throw new Error(`Unexpected request: ${path}`);

    return new Response(JSON.stringify(value), { status });
  });

  return calls;
}

test('仓库标识拒绝 URL 注入及路径穿越', () => {
  assert.equal(GetRepository(' OWNER/REPOSITORY '), 'OWNER/REPOSITORY');
  for (const value of ['https://other.invalid/repo', 'a/../b', 'a/b?token=x', 'a/b#x', 'a/..']) {
    assert.throws(() => GetRepository(value));
  }
});

test('索引保留换行、空格与原始提示词；拒绝危险图片与重复记录', () => {
  const catalog = { version: 1, entries: [firstEntry] };

  assert.equal(GetCatalog(catalog).entries[0].prompt, firstEntry.prompt);
  assert.throws(() => GetCatalog({ version: 2, entries: [] }));
  assert.throws(() => GetCatalog({ version: 1, entries: [firstEntry, firstEntry] }));
  assert.throws(() => GetCatalog({ version: 1, entries: [{ ...firstEntry, images: [{ path: 'https://evil.invalid/image.svg', width: 1, height: 1 }] }] }));
});

test('合并其他组的变更，拒绝同一组的并发覆盖', () => {
  const catalog = { version: 1, entries: [firstEntry, secondEntry] };
  const changed = { ...firstEntry, prompt: '更新\n提示词' };

  assert.deepEqual(GetMergedCatalog(catalog, firstEntry, changed).entries, [changed, secondEntry]);
  assert.throws(() => GetMergedCatalog({ version: 1, entries: [changed] }, firstEntry, firstEntry));
  assert.throws(() => GetMergedCatalog({ version: 1, entries: [] }, firstEntry, changed));
  assert.deepEqual(GetMergedCatalog(catalog, firstEntry, null).entries, [secondEntry]);
});

test('无编辑凭证不产生任何写请求', async context => {
  const calls = GetMock(context, { version: 1, entries: [] });
  const store = new GitHubStore('OWNER/REPOSITORY');

  await assert.rejects(store.SetEntry(null, firstEntry, []), /编辑凭证/);
  assert.equal(calls.length, 0);
});

test('公开读取不携带凭证，私有仓库不会被当作公开库', async context => {
  const calls = GetMock(context, { version: 1, entries: [firstEntry] });
  const store = new GitHubStore('OWNER/REPOSITORY');
  const snapshot = await store.GetSnapshot();

  assert.equal(snapshot.catalog.entries[0].prompt, firstEntry.prompt);
  assert.ok(calls.every(call => !call.headers.Authorization));
});

test('拒绝私有仓库，即使管理员能读取', async context => {
  GetMock(context, { version: 1, entries: [] }, { private: true });
  const store = new GitHubStore('OWNER/REPOSITORY', 'TEST_ONLY');

  await assert.rejects(store.GetConnection(), /公开仓库/);
});

test('保存图片与索引只发布一个原子提交，禁止强推', async context => {
  const calls = GetMock(context, { version: 1, entries: [firstEntry] });
  const store = new GitHubStore('OWNER/REPOSITORY', 'TEST_ONLY');
  const saved = await store.SetEntry(null, secondEntry, [{ path: secondEntry.images[0].path, base64: 'AA==' }]);
  const mutations = calls.filter(call => call.method !== 'GET');

  assert.deepEqual(mutations.map(call => call.path), ['/git/blobs', '/git/trees', '/git/commits', '/git/refs/heads/gallery-data']);
  assert.equal(mutations[1].body.base_tree, 'old-tree');
  assert.deepEqual(mutations[2].body.parents, ['old-commit']);
  assert.equal(mutations[3].body.force, false);
  assert.equal(saved.head, 'new-commit');
  assert.equal(saved.catalog.entries.length, 2);
  assert.ok(!JSON.stringify(mutations.map(call => call.body)).includes('TEST_ONLY'));
  assert.equal(JSON.stringify(store), '{}');
  store.StopEditing();
  assert.equal(store.IsEditing(), false);
});

test('首次保存创建独立根提交与数据分支，不带入源码', async context => {
  const calls = GetMock(context, { version: 1, entries: [] }, { empty: true });
  const store = new GitHubStore('OWNER/REPOSITORY', 'TEST_ONLY');

  await store.SetEntry(null, firstEntry, [{ path: firstEntry.images[0].path, base64: 'AA==' }]);
  assert.deepEqual(calls.find(call => call.path === '/git/commits').body.parents, []);
  assert.equal(calls.find(call => call.path === '/git/refs').body.ref, 'refs/heads/gallery-data');
  assert.equal(calls.find(call => call.path === '/git/trees').body.base_tree, undefined);
});

test('上传中途失败不发布索引，也不更新分支', async context => {
  const calls = GetMock(context, { version: 1, entries: [] }, { uploadFails: true });
  const store = new GitHubStore('OWNER/REPOSITORY', 'TEST_ONLY');

  await assert.rejects(store.SetEntry(null, firstEntry, [{ path: firstEntry.images[0].path, base64: 'AA==' }]));
  assert.ok(!calls.some(call => call.path === '/git/trees' || call.path.startsWith('/git/refs')));
});

test('并发非快进更新失败不会改成强推重试', async context => {
  const calls = GetMock(context, { version: 1, entries: [firstEntry] }, { conflict: true });
  const store = new GitHubStore('OWNER/REPOSITORY', 'TEST_ONLY');

  await assert.rejects(store.SetEntry(firstEntry, { ...firstEntry, prompt: 'changed' }, []), /保存被拒绝/);
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 1);
  assert.equal(calls.at(-1).body.force, false);
});

test('删除仅移除目标组的图片，保留其他收藏', async context => {
  const calls = GetMock(context, { version: 1, entries: [firstEntry, secondEntry] });
  const store = new GitHubStore('OWNER/REPOSITORY', 'TEST_ONLY');
  const saved = await store.SetEntry(firstEntry, null, []);
  const tree = calls.find(call => call.path === '/git/trees').body.tree;

  assert.deepEqual(tree.filter(entry => entry.sha === null).map(entry => entry.path), [firstEntry.images[0].path]);
  assert.deepEqual(saved.catalog.entries, [secondEntry]);
});
