// drawalg: draw.io masaüstü uygulamasının giriş noktası.
// Önce resmi draw.io ana sürecini yükler, ardından her editör penceresine
// drawalg eklentisini (plugins/drawalg.js) enjekte eder.
import './drawalg-pre.js';
import './electron.js';

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// draw.io masaüstü özelliklerini (kaydet, aç, kapat…) tarayıcı kimliğindeki
// " draw.io/" ifadesine bakarak etkinleştirir; uygulama adı drawalg olduğu için
// bu ifadeyi elle ekliyoruz.
if (app.userAgentFallback.indexOf(' draw.io/') < 0)
{
	app.userAgentFallback = app.userAgentFallback + ' draw.io/' + app.getVersion();
}

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginPath = path.join(here, '..', '..', 'drawio', 'src', 'main', 'webapp', 'plugins', 'drawalg.js');

let pluginCode = null;

function getPluginCode()
{
	if (pluginCode == null)
	{
		pluginCode = fs.readFileSync(pluginPath, 'utf8');
	}

	return pluginCode;
}

app.on('browser-window-created', (_event, win) =>
{
	win.webContents.on('did-finish-load', () =>
	{
		let url = '';

		try
		{
			url = win.webContents.getURL();
		}
		catch (e)
		{
			return;
		}

		// Yalnızca ana editör sayfası (dışa aktarma vb. pencereler değil)
		if (!/\/index\.html(\?|#|$)/.test(url))
		{
			return;
		}

		win.webContents.executeJavaScript(getPluginCode(), true).catch((err) =>
		{
			console.error('drawalg eklentisi yüklenemedi:', err);
		});
	});
});

// macOS'ta son pencere kapanınca uygulama Dock'ta açık kalmasın, tamamen kapansın
app.on('window-all-closed', () =>
{
	if (process.platform === 'darwin')
	{
		app.quit();
	}
});
