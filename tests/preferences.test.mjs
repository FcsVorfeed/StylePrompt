import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BrowserPreferences } from '../src/BrowserStorageSystem/preferences.js';

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 使用内存代替浏览器存储，测试值不包含真实凭证。
function GetStorage() {
  const values = new Map();

  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test('重建页面偏好实例后恢复同一仓库凭证，退出只清除凭证', () => {
  const storage = GetStorage();
  const preferences = new BrowserPreferences(() => storage, '/gallery/');
  const connection = { repository: 'OWNER/REPOSITORY', token: 'TEST_ONLY' };

  assert.equal(preferences.TrySetConnection(connection), true);
  assert.equal(preferences.TrySetGallerySize(55), true);

  const restored = new BrowserPreferences(() => storage, '/gallery/');

  assert.deepEqual(restored.GetConnection(), connection);
  assert.equal(restored.GetGallerySize(), 55);
  assert.equal(restored.TrySetConnection(null), true);
  assert.equal(preferences.GetConnection(), null);
  assert.equal(preferences.GetGallerySize(), 55);
});

test('拒绝损坏或不合法的本地凭证，不将值拼入异常消息', () => {
  const storage = GetStorage();
  const preferences = new BrowserPreferences(() => storage, '/gallery/');

  for (const value of ['not-json', '{}', '{"repository":"../secret","token":"TEST_ONLY"}', '{"repository":"OWNER/REPOSITORY","token":{}}']) {
    storage.setItem('styleprompt:/gallery/:connection', value);
    assert.equal(preferences.GetConnection(), null);
  }

  assert.equal(preferences.TrySetConnection({ repository: '../secret', token: 'TEST_ONLY' }), false);
});

test('部署路径隔离偏好键，不读取其他工具的连接', () => {
  const storage = GetStorage();
  const first = new BrowserPreferences(() => storage, '/first/');
  const second = new BrowserPreferences(() => storage, '/second/');

  first.TrySetConnection({ repository: 'OWNER/REPOSITORY', token: 'TEST_ONLY' });
  first.TrySetGallerySize(100);
  assert.equal(second.GetConnection(), null);
  assert.equal(second.GetGallerySize(), 70);
});

test('尺寸边界及损坏偏好恢复默认值', () => {
  const storage = GetStorage();
  const preferences = new BrowserPreferences(() => storage, '/gallery/');

  assert.equal(preferences.GetGallerySize(), 70);

  for (const size of [40, 70, 140]) {
    assert.equal(preferences.TrySetGallerySize(size), true);
    assert.equal(preferences.GetGallerySize(), size);
  }

  for (const value of ['0', '1000', 'NaN', '41', '-1', '70px']) {
    storage.setItem('styleprompt:/gallery/:gallery-size', value);
    assert.equal(preferences.GetGallerySize(), 70);
  }

  assert.equal(preferences.TrySetGallerySize(141), false);
});

test('浏览器禁止存储时不阻塞读取或抛出含凭证的异常', () => {
  const preferences = new BrowserPreferences(() => { throw new Error('Storage blocked'); }, '/gallery/');

  assert.equal(preferences.GetConnection(), null);
  assert.equal(preferences.GetGallerySize(), 70);
  assert.equal(preferences.TrySetConnection({ repository: 'OWNER/REPOSITORY', token: 'TEST_ONLY' }), false);
  assert.equal(preferences.TrySetConnection(null), false);
  assert.equal(preferences.TrySetGallerySize(80), false);
});

test('写入新连接失败后不恢复旧账号的凭证', () => {
  const storage = GetStorage();
  const preferences = new BrowserPreferences(() => storage, '/gallery/');

  preferences.TrySetConnection({ repository: 'OWNER/OLD', token: 'TEST_ONLY' });
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.equal(preferences.TrySetConnection({ repository: 'OWNER/NEW', token: 'TEST_NEW' }), false);
  assert.equal(preferences.GetConnection(), null);
});
