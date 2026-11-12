// web-dist/ klasörünü yerelde sunar (yalnızca deneme için).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './common.mjs';

const OUT = path.join(ROOT, 'web-dist');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
	'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
	'.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif',
	'.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
	'.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm'
};

if (!fs.existsSync(path.join(OUT, 'index.html')))
{
	console.error('Önce:  npm run build-web');
	process.exit(1);
}

http.createServer((req, res) =>
{
	let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
	let file = path.join(OUT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));

	if (!file.startsWith(OUT))
	{
		res.writeHead(403).end();
		return;
	}

	if (fs.existsSync(file) && fs.statSync(file).isDirectory())
	{
		file = path.join(file, 'index.html');
	}

	fs.readFile(file, (err, data) =>
	{
		if (err)
		{
			res.writeHead(404).end('Bulunamadı');
			return;
		}

		res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
		res.end(data);
	});
}).listen(PORT, () => console.log(`drawalg web demosu: http://localhost:${PORT}`));
