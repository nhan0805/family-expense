import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const assetsDir = new globalThis.URL('../dist/assets/', import.meta.url);
const files = await readdir(assetsDir);
const entry = files.find((file) => /^index-.*\.js$/.test(file));
if (!entry) throw new Error('Không tìm thấy entry JavaScript trong dist/assets.');

const bytes = gzipSync(await readFile(new globalThis.URL(entry, assetsDir))).length;
const limit = 30 * 1024;
globalThis.console.log(`Performance budget: ${entry} gzip=${bytes}B limit=${limit}B`);
if (bytes > limit) {
  throw new Error(`Entry JavaScript vượt performance budget (${bytes}B > ${limit}B).`);
}
