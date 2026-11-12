// Web demosu: draw.io web uygulamasını drawalg eklentisiyle birlikte web-dist/ klasörüne kurar.
// Çıktı herhangi bir statik sunucuda (ör. GitHub Pages) yayınlanabilir.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, WEBAPP, fetchVendor } from './common.mjs';

const OUT = path.join(ROOT, 'web-dist');
const SKIP = new Set(['WEB-INF', 'META-INF']);

fetchVendor();

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(WEBAPP, OUT, {
	recursive: true,
	filter: (src) => !SKIP.has(path.basename(src)) && !src.endsWith('.map')
});

// 1) Eklenti
fs.mkdirSync(path.join(OUT, 'plugins'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'plugin', 'drawalg.js'), path.join(OUT, 'plugins', 'drawalg.js'));

// 2) index.html: başlık ve eklenti
const indexPath = path.join(OUT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/, '<title>drawalg — Algoritma Akış Diyagramı</title>');

if (html.indexOf('plugins/drawalg.js') < 0)
{
	html = html.replace('<script src="js/main.js"></script>',
		'<script src="js/main.js"></script>\n<script src="plugins/drawalg.js"></script>');
}

if (html.indexOf('plugins/drawalg.js') < 0)
{
	console.error('index.html beklenen yapıda değil, eklenti eklenemedi.');
	process.exit(1);
}

fs.writeFileSync(indexPath, html);

// 3) Varsayılan ayarlar: açılış ekranı yok, dış servisler kapalı
fs.appendFileSync(path.join(OUT, 'js', 'PreConfig.js'), `
// drawalg web demosu varsayılanları
if (urlParams['splash'] == null) urlParams['splash'] = '0';
if (urlParams['stealth'] == null) urlParams['stealth'] = '1';
`);

// 4) Çevrimdışı önbellek (service worker) kapalı: eski sürümler takılı kalmasın
fs.writeFileSync(path.join(OUT, 'service-worker.js'),
	"self.addEventListener('install', function () { self.skipWaiting(); });\n" +
	"self.addEventListener('activate', function () { self.registration.unregister(); });\n");

// 5) GitHub Pages'in dosyaları olduğu gibi sunması için
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log('Web demosu hazır: ' + path.relative(ROOT, OUT) + '/');
console.log('Yerelde denemek için:  npm run serve-web   →  http://localhost:8080');
