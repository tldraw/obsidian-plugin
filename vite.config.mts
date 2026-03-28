import path from 'path';
import { defineConfig } from 'vite';
import { createViteObsidianPlugin } from '@obsidian-plugin-toolkit/vite';
import react from '@vitejs/plugin-react';
import { version } from './node_modules/tldraw/package.json';

const NODE_ENV = process.env.NODE_ENV
const prod = NODE_ENV === 'production'

const TLDRAW_VERSION = JSON.stringify(version)

const outdir = prod
	? path.join(import.meta.dirname, 'dist', 'production')
	: path.join(import.meta.dirname, 'dist', 'development')

console.log({
  prod,
  TLDRAW_VERSION,
  outdir,
  NODE_ENV: process.env.NODE_ENV
});

export default defineConfig(() => {
  return {
    build: {
      target: 'es2023',
      sourcemap: !prod,
      outDir: outdir,
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    },
    define: {
      TLDRAW_VERSION,
      MARKDOWN_POST_PROCESSING_LOGGING: `${!prod}`,
      TLDRAW_COMPONENT_LOGGING: `${!prod}`,
    },
    resolve: {
      alias: {
        src: path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      react(),
      createViteObsidianPlugin({
        entryPoints: ['src/main.ts', 'src/styles.css'],
        outDir: outdir,
        manifestPath: path.resolve(import.meta.dirname, 'manifest.json'),
      })
    ],
  }
});