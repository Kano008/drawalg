// İlk kurulum: draw.io masaüstü kaynağını indirir ve bağımlılıkları kurar.
import { VENDOR, run, apply, fetchVendor } from './common.mjs';

fetchVendor();
run('npm', ['install', '--no-audit', '--no-fund'], { cwd: VENDOR });
apply();

console.log('\nKurulum tamam. Uygulamayı başlatmak için:  npm start');
