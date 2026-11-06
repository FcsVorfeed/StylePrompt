import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';

// 浏览器验收独立端口，只提供明确的合成夹具与网页源码。
const root = fileURLToPath(new URL('../', import.meta.url));
const palette = [['#cbd7bd', '#557554', '#e9e9cc'], ['#dacbc0', '#987158', '#f2e7d7'], ['#c7d9df', '#4e7c8b', '#e9efe6'], ['#dfcbd7', '#976c85', '#f2e2d4']];

await mkdir(resolve(root, 'private/qa'), { recursive: true });
await writeFile(resolve(root, 'private/qa/upload.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// 使用可辨识的几何图案验证比例和排列，不混入生产收藏。
async function OnRequest(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  response.setHeader('Cache-Control', 'no-store');

  try {
    if (pathname.startsWith('/test-images/')) {
      const index = Number(pathname.split('/').at(-1)[0]);
      const [background, ink, light] = palette[(index - 1) % palette.length] || palette[0];
      const shape = index % 2 === 0
        ? `<rect x="145" y="230" width="310" height="460" rx="150" fill="${ink}"/><circle cx="450" cy="240" r="120" fill="${light}"/>`
        : `<circle cx="300" cy="320" r="190" fill="${light}"/><path d="M0 800 280 290 600 800" fill="${ink}"/>`;

      response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      response.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect width="600" height="800" fill="${background}"/>${shape}<path d="M65 720H535" stroke="${light}" stroke-width="2"/><text x="65" y="765" font-family="sans-serif" letter-spacing="8" font-size="18" fill="${ink}">SYNTHETIC ${index || 1}</text></svg>`);
      return;
    }

    if (pathname !== '/' && pathname !== '/index.html' && pathname !== '/tests/browser-fixture.js' && !/^\/src\/[A-Za-z0-9_/-]+\.(js|css)$/.test(pathname)) {
      response.writeHead(404).end();
      return;
    }

    const target = resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
    let content = await readFile(target, 'utf8');

    if (extname(target) === '.html') content = content.replace('./src/AppSystem/app.js', './tests/browser-fixture.js');

    response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(target)] });
    response.end(content);
  } catch {
    response.writeHead(500).end();
  }
}

createServer(OnRequest).listen(4174, '127.0.0.1', () => console.log('QA: http://127.0.0.1:4174'));
