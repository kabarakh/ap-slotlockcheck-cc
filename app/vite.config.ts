import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import json5 from 'vite-plugin-json5';

const serverUrl = process.env.SLOTLOCK_SERVER_URL ?? 'http://localhost:3000';
const publicHosts = (process.env.SLOTLOCK_PUBLIC_DEV_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter((host) => host.length > 0);

export default defineConfig({
  plugins: [vue(), vueDevTools(), json5()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: publicHosts.length > 0 ? true : 'localhost',
    allowedHosts: publicHosts,
    proxy: {
      '/api': { target: serverUrl },
      '/socket.io': { target: serverUrl, ws: true },
    },
  },
});
