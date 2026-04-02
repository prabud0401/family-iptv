const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const WWW = path.join(__dirname, 'www');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
  '.vtt': 'text/vtt', '.srt': 'text/plain',
};

function proxyFetch(targetUrl, referer) {
  return new Promise((resolve, reject) => {
    const proto = targetUrl.startsWith('https') ? https : http;
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
    if (referer) headers['Referer'] = referer;
    if (referer) headers['Origin'] = new URL(referer).origin;
    proto.get(targetUrl, { headers }, proxyRes => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        return proxyFetch(proxyRes.headers.location, referer).then(resolve, reject);
      }
      resolve(proxyRes);
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (parsed.pathname === '/proxy') {
    const target = parsed.query.url;
    if (!target) { res.writeHead(400); res.end('Missing ?url= param'); return; }
    try {
      const proxyRes = await proxyFetch(target);
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    } catch (err) {
      res.writeHead(502); res.end('Proxy error: ' + err.message);
    }
    return;
  }

  if (parsed.pathname === '/m3u8-proxy') {
    const target = parsed.query.url;
    const referer = parsed.query.referer || '';
    if (!target) { res.writeHead(400); res.end('Missing url'); return; }
    try {
      const proxyRes = await proxyFetch(target, referer);
      const ct = proxyRes.headers['content-type'] || 'application/octet-stream';
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': ct,
        'Access-Control-Allow-Origin': '*',
      });
      if (ct.includes('mpegurl') || ct.includes('m3u8') || target.includes('.m3u8')) {
        let body = '';
        proxyRes.on('data', c => body += c);
        proxyRes.on('end', () => {
          const baseUrl = target.substring(0, target.lastIndexOf('/') + 1);
          const rewritten = body.replace(/^(?!#)(.+\.(?:m3u8|ts).*)$/gm, line => {
            const absolute = line.startsWith('http') ? line : baseUrl + line;
            return `/m3u8-proxy?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer)}`;
          });
          res.end(rewritten);
        });
      } else {
        proxyRes.pipe(res);
      }
    } catch (err) {
      res.writeHead(502); res.end('Proxy error: ' + err.message);
    }
    return;
  }

  let filePath = path.join(WWW, parsed.pathname === '/' ? 'index.html' : parsed.pathname);
  if (!fs.existsSync(filePath)) { filePath = path.join(WWW, 'index.html'); }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}\n  /resolve?tmdb=603&type=movie  - stream resolver\n  /m3u8-proxy?url=...&referer=  - HLS proxy\n  /proxy?url=                   - CORS proxy`));
