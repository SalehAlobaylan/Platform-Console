import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { createNitro } from 'nitro/builder';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig(async ({ command }) => {
    const config = {
        preset: 'node_server',
        compressPublicAssets: command === 'build' && { gzip: true, brotli: true },
    };
    const isolated = command === 'build' || process.env.WAHB_MANAGED_ENV === '1';
    // Nitro has its own dotenv reader in addition to Vite's envDir setting.
    const instance = isolated
        ? await createNitro({ ...config, builder: 'vite', dev: command === 'serve' }, { dotenv: false })
        : undefined;
    const start = tanstackStart({
        importProtection: {
            client: { files: [/\/src\/(?:app\/api|lib\/server)\//] },
        },
    }).flat(2);
    // Start's bundled env plugin ignores Vite's envDir option. Only
    // unmanaged service-local development may use the dotenv fallback.
    const startPlugins = isolated
        ? start.filter((plugin) => !plugin || typeof plugin !== 'object' ||
            !('name' in plugin) || plugin.name !== 'tanstack-start-core:load-env')
        : start;
    return {
        envDir: false as const,
        resolve: { tsconfigPaths: true },
        server: { port: 3005, strictPort: true },
        plugins: [
            startPlugins,
            nitro({ ...config, _nitro: instance }),
            react(),
        ],
    };
});
