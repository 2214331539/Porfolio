import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pdfjsRoot = join(projectRoot, 'node_modules', 'pdfjs-dist');
const publicRoot = join(projectRoot, 'frontend', 'public', 'pdfjs');
const assetDirectories = ['cmaps', 'standard_fonts', 'wasm'];

for (const directory of assetDirectories) {
  const source = join(pdfjsRoot, directory);
  if (!existsSync(source)) throw new Error(`Missing PDF.js asset directory: ${source}`);
  const destination = join(publicRoot, directory);
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}

console.log('PDF.js support assets are ready.');
