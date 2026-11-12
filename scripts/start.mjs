// drawalg'ı geliştirme modunda başlatır (eklentideki değişiklikler her açılışta uygulanır).
import path from 'node:path';
import { VENDOR, isWin, run, apply } from './common.mjs';

apply();

const electron = path.join(VENDOR, 'node_modules', '.bin', isWin ? 'electron.cmd' : 'electron');
run(electron, ['.', ...process.argv.slice(2)], { cwd: VENDOR });
