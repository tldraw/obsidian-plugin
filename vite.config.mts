import path from 'path';
import { defineConfig } from 'vite';
import obsidian from '@obsidian-plugin-toolkit/vite';
import react from '@vitejs/plugin-react';
import tldrawPackageJson from './node_modules/tldraw/package.json' with { type: 'json' };

const { version } = tldrawPackageJson;

const NODE_ENV = process.env.NODE_ENV
const prod = NODE_ENV === 'production'

const TLDRAW_VERSION = JSON.stringify(version)

console.log({
  prod,
  TLDRAW_VERSION,
  NODE_ENV: process.env.NODE_ENV
});

export default defineConfig(() => {
  return {
    build: {
      target: 'es2023',
      sourcemap: !prod,
      emptyOutDir: true,
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
      TLDRAW_VERSION,
    },
    resolve: {
      alias: {
        src: path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      react(),
      obsidian()
    ],
  }
});