import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('./web', import.meta.url)), plugins: [solid()], build: { outDir: '../dist', emptyOutDir: true }, server: { host: '127.0.0.1' } });
