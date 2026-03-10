import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

const TLDRAW_VERSION = JSON.stringify(
  JSON.parse(readFileSync(path.resolve(__dirname, 'node_modules', 'tldraw', 'package.json'), 'utf8')).version
);

console.log('TLDRAW_VERSION', TLDRAW_VERSION);

export default defineConfig(async () => {
  const { createViteObsidianConfig } = await import(
    '@obsidian-plugin-toolkit/vite'
  );
  return createViteObsidianConfig({
    root: __dirname,
    development: {
      entryPoints: ['src/main.ts', 'src/styles.css'],
      outdir: path.resolve(__dirname, 'dist', 'development'),
      manifestPath: path.resolve(__dirname, 'manifest.json'),
      watchShim: true,
    },
    // reactOptions: {
    //   babel: {
    //     plugins: [
    //       ['@babel/plugin-proposal-decorators', { version: '2023-11' }]
    //     ]
    //   }
    // },
    define: {
      TLDRAW_VERSION,
    },
    alias: {
      src: path.resolve(__dirname, './src'),
    }
  });
});