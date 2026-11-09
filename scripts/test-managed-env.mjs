import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// Use an exclusive, uniquely named mode fixture. Existing service env files
// and the selected managed profile remain untouched.
const mode = `console-env-sentinel-${process.pid}`;
const sentinel = `.env.${mode}.local`;
await writeFile(sentinel, 'GRAFANA_URL=dotenv-fallback-must-not-load\n', { flag: 'wx' });
let child;
try {
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise((done) => reservation.close(done));
    child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'dev', '--mode', mode, '--host', '127.0.0.1', '--port', String(port)], {
        env: { PATH: process.env.PATH, WAHB_MANAGED_ENV: '1', WAHB_RUNTIME_ID: 'env-test-launch' },
        stdio: ['ignore', 'ignore', 'inherit'],
    });
    let html;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null || child.signalCode !== null) throw new Error('Managed Console exited during sentinel check');
        const response = await fetch(`http://127.0.0.1:${port}/login`).catch(() => null);
        if (response?.ok) {
            html = await response.text();
            break;
        }
        await delay(100);
    }
    if (!html?.includes('content="env-test-launch"') || html.includes('dotenv-fallback-must-not-load')) {
        throw new Error('Managed Start did not isolate the launch environment');
    }
    console.log('Managed Start ignored the service dotenv sentinel.');
} finally {
    if (child && child.exitCode === null && child.signalCode === null) {
        const finished = once(child, 'exit');
        child.kill();
        await finished;
    }
    await rm(sentinel);
}
