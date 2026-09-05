/**
 * 本机试玩 · 不需要 Google，不需要装东西
 *
 *   cd 到这个资料夹，然后跑：   node run_local.js
 *
 * 它会印出两个网址：电脑用 localhost，手机用 192.168.x.x（要同一个 WiFi）。
 * 这只是练习用的。正式上线还是照 README 部署 Apps Script。
 * 关掉视窗，这局的分数就没了。
 */
const http = require('http'), fs = require('fs'), os = require('os'),
      url = require('url'), path = require('path');

const HERE = __dirname;
const PORT = Number(process.env.PORT || 8080);

// ---- 把 Code.gs 当成真的后端跑，补上 Apps Script 才有的三个东西 ----
const store = {};
const PropertiesService = { getScriptProperties: () => ({
  getProperty: k => store[k], setProperty: (k, v) => { store[k] = v; } }) };
const ContentService = { createTextOutput: t => ({ setMimeType: () => t }),
                         MimeType: { JSON: 'json' } };
const LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };

eval(fs.readFileSync(path.join(HERE, 'Code.gs'), 'utf8'));

// ---- 伺服器 ----
const send = (res, code, type, body) => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
};

http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  if (u.pathname === '/api') {
    if (req.method === 'POST') {
      let b = '';
      req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); });
      req.on('end', () => send(res, 200, 'application/json', doPost({ postData: { contents: b } })));
    } else {
      send(res, 200, 'application/json', doGet({ parameter: u.query }));
    }
    return;
  }

  // 每次都重新读档，改了 index.html 重整就看得到
  try {
    send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(path.join(HERE, 'index.html')));
  } catch (e) {
    send(res, 500, 'text/plain; charset=utf-8', '找不到 index.html');
  }
}).listen(PORT, () => {
  const lan = [].concat(...Object.values(os.networkInterfaces()))
    .filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('\n  旷野公司 · 本机试玩中\n');
  console.log('  这台电脑（大屏幕）  http://localhost:' + PORT);
  lan.forEach(ip => console.log('  手机（同一个 WiFi）  http://' + ip + ':' + PORT));
  console.log('\n  主持人密码 ' + PIN + '　·　Ctrl+C 结束，分数不会留着\n');
});
