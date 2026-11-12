// Çift tıklanarak açılabilen uygulamayı üretir (vendor/drawio-desktop/dist/ altında).
import fs from 'node:fs';
import path from 'node:path';
import { VENDOR, isWin, run, apply } from './common.mjs';

apply();

const builder = path.join(VENDOR, 'node_modules', '.bin', isWin ? 'electron-builder.cmd' : 'electron-builder');
run(builder, ['--config', 'electron-builder-drawalg.json', '--publish', 'never'], { cwd: VENDOR });

// macOS: imzasız uygulamanın Apple Silicon'da açılabilmesi için yerel (ad-hoc) imza
if (process.platform === 'darwin')
{
	const distDir = path.join(VENDOR, 'dist');

	for (const sub of fs.readdirSync(distDir))
	{
		const appPath = path.join(distDir, sub, 'drawalg.app');

		if (fs.existsSync(appPath))
		{
			run('codesign', ['--force', '--deep', '--sign', '-', appPath]);
			console.log('\nUygulama hazır: ' + appPath);
			console.log('İstersen Uygulamalar klasörüne sürükleyebilirsin.');
		}
	}
}
else
{
	console.log('\nÇıktılar: ' + path.join(VENDOR, 'dist'));
}
