import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import json5 from 'vite-plugin-json5';

const serverUrl = process.env.SLOTLOCK_SERVER_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [vue(), vueDevTools(), json5()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': { target: serverUrl },
      '/socket.io': { target: serverUrl, ws: true },
    },
  },
});
