import basicSsl from '@vitejs/plugin-basic-ssl';
import vue from '@vitejs/plugin-vue';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import json5 from 'vite-plugin-json5';
import vueDevTools from 'vite-plugin-vue-devtools';
import { defineConfig, type PluginOption } from 'vite-plus';

import { publicDevHost } from './scripts/public-dev-host.ts';

const serverUrl = process.env.SLOTLOCK_SERVER_URL ?? 'http://localhost:3000';
const publicHosts = process.env.SLOTLOCK_PUBLIC_DEV === 'true' ? [publicDevHost()] : [];
const isPublicDev = publicHosts.length > 0;
const publicPort = Number(process.env.SLOTLOCK_PUBLIC_DEV_PORT ?? 443);

const certificatePath = (extension: string) =>
  fileURLToPath(new URL(`./.certs/${publicHosts[0] ?? ''}.${extension}`, import.meta.url));
const hasTrustedCertificate = isPublicDev && existsSync(certificatePath('crt')) && existsSync(certificatePath('key'));
const httpsPlugins: PluginOption[] = isPublicDev && !hasTrustedCertificate ? [basicSsl({ domains: publicHosts })] : [];

export default defineConfig({
  plugins: [vue(), vueDevTools(), json5(), ...httpsPlugins],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: isPublicDev ? true : 'localhost',
    allowedHosts: publicHosts,
    https: hasTrustedCertificate
      ? { cert: readFileSync(certificatePath('crt')), key: readFileSync(certificatePath('key')) }
      : undefined,
    hmr: isPublicDev ? { clientPort: publicPort } : undefined,
    proxy: {
      '/api': { target: serverUrl },
      '/socket.io': { target: serverUrl, ws: true },
    },
  },
});
