import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';
import vueDevTools from 'vite-plugin-vue-devtools';
import json5 from 'vite-plugin-json5';

const serverUrl = process.env.SLOTLOCK_SERVER_URL ?? 'http://localhost:3000';
const publicHosts = (process.env.SLOTLOCK_PUBLIC_DEV_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter((host) => host.length > 0);
const isPublicDev = publicHosts.length > 0;
const publicPort = Number(process.env.SLOTLOCK_PUBLIC_DEV_PORT ?? 443);

export default defineConfig({
  plugins: [vue(), vueDevTools(), json5(), ...(isPublicDev ? [basicSsl({ domains: publicHosts })] : [])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: isPublicDev ? true : 'localhost',
    allowedHosts: publicHosts,
    hmr: isPublicDev ? { clientPort: publicPort } : undefined,
    proxy: {
      '/api': { target: serverUrl },
      '/socket.io': { target: serverUrl, ws: true },
    },
  },
});
