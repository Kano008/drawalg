// drawalg kurulum/çalıştırma betikleri için ortak yardımcılar.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VENDOR = path.join(ROOT, 'vendor', 'drawio-desktop');
export const WEBAPP = path.join(VENDOR, 'drawio', 'src', 'main', 'webapp');

// Test edilmiş draw.io masaüstü sürümü
export const DRAWIO_DESKTOP_TAG = 'v32.6.10';
export const DRAWIO_DESKTOP_REPO = 'https://github.com/jgraph/drawio-desktop.git';

export const isWin = process.platform === 'win32';

export function run(cmd, args, opts = {})
{
	console.log(`\n> ${cmd} ${args.join(' ')}`);
	const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin, ...opts });

	if (r.status !== 0)
	{
		console.error(`\nKomut başarısız oldu (${r.status}): ${cmd} ${args.join(' ')}`);
		process.exit(r.status || 1);
	}
}

// draw.io masaüstü kaynağını (ve içindeki draw.io web uygulamasını) indirir
export function fetchVendor()
{
	if (!fs.existsSync(path.join(VENDOR, 'package.json')))
	{
		fs.mkdirSync(path.dirname(VENDOR), { recursive: true });
		run('git', ['clone', '--depth', '1', '--branch', DRAWIO_DESKTOP_TAG, DRAWIO_DESKTOP_REPO, VENDOR]);
	}
	else
	{
		console.log('draw.io kaynağı zaten var: ' + path.relative(ROOT, VENDOR));
	}

	if (!fs.existsSync(path.join(WEBAPP, 'index.html')))
	{
		run('git', ['-C', VENDOR, 'submodule', 'update', '--init', '--depth', '1', 'drawio']);
	}
}

export function ensureVendor()
{
	if (!fs.existsSync(path.join(VENDOR, 'package.json')) || !fs.existsSync(path.join(WEBAPP, 'index.html')))
	{
		console.error('draw.io kaynakları bulunamadı. Önce şunu çalıştırın:  npm run setup');
		process.exit(1);
	}
}

// drawalg dosyalarını draw.io masaüstü kaynağına uygular (her başlatmada tekrar çalışır)
export function apply()
{
	ensureVendor();

	// 1) Eklenti ve giriş dosyaları
	fs.mkdirSync(path.join(WEBAPP, 'plugins'), { recursive: true });
	fs.copyFileSync(path.join(ROOT, 'plugin', 'drawalg.js'), path.join(WEBAPP, 'plugins', 'drawalg.js'));
	fs.copyFileSync(path.join(ROOT, 'app', 'drawalg-pre.js'), path.join(VENDOR, 'src', 'main', 'drawalg-pre.js'));
	fs.copyFileSync(path.join(ROOT, 'app', 'drawalg-main.js'), path.join(VENDOR, 'src', 'main', 'drawalg-main.js'));

	// 2) Uygulama adı ve giriş noktası
	const pkgPath = path.join(VENDOR, 'package.json');
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
	const ours = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
	pkg.name = 'drawalg';
	pkg.productName = 'drawalg';
	pkg.description = 'drawalg — algoritma akış diyagramı editörü (draw.io tabanlı)';
	pkg.main = 'src/main/drawalg-main.js';
	pkg.exports = './src/main/drawalg-main.js';
	pkg.version = ours.version || pkg.version;
	fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

	// 3) Paketleme ayarı (npm run dist)
	const baseCfg = JSON.parse(fs.readFileSync(path.join(VENDOR, 'electron-builder-linux-mac.json'), 'utf8'));
	const cfg = {
		appId: 'com.drawalg.app',
		productName: 'drawalg',
		asar: true,
		files: baseCfg.files,
		artifactName: '${productName}-${arch}-${version}.${ext}',
		directories: { output: './dist/' },
		npmRebuild: false,
		publish: null,
		mac: {
			target: ['dir'],
			identity: null,
			category: 'public.app-category.graphics-design',
			extendInfo: baseCfg.mac && baseCfg.mac.extendInfo
		},
		win: { target: ['portable'] },
		linux: { target: ['AppImage'], category: 'Graphics' }
	};
	fs.writeFileSync(path.join(VENDOR, 'electron-builder-drawalg.json'), JSON.stringify(cfg, null, 2) + '\n');

	console.log('drawalg dosyaları uygulandı.');
}
