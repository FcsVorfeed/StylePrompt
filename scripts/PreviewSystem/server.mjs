import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 本地预览只暴露网页源文件，private、Git/SVN 元数据和测试脚本均不可下载。
const root = fileURLToPath(new URL('../../', import.meta.url));
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const port = Number(process.env.PORT || 4173);

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 路径允许列表优先于文件读取，阻止直接访问私有目录或编码后的路径穿越。
async function OnRequest(request, response) {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end();
      return;
    }

    if (pathname === '/runtime-config.json') {
      let repository = '';

      try {
        const config = JSON.parse(await readFile(resolve(root, 'private/config/site.json'), 'utf8'));

        repository = config.repository || '';
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ repository }));
      return;
    }

    if (pathname !== '/' && pathname !== '/index.html' && !/^\/src\/[A-Za-z0-9_/-]+\.(js|css)$/.test(pathname)) {
      response.writeHead(404).end('Not found');
      return;
    }

    const target = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);

    if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403).end();
      return;
    }

    const content = await readFile(target);

    response.writeHead(200, { 'Content-Type': `${mimeTypes[extname(target)]}; charset=utf-8` });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Unable to load');
  }
}

createServer(OnRequest).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
