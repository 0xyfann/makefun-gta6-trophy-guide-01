import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const catalog = JSON.parse(readFileSync(join(here, 'app/data/trophies.json'), 'utf8'));
const browserCatalog = readFileSync(join(here, 'app/data/catalog.js'), 'utf8');
const records = catalog.trophies.map(trophy => `  ${JSON.stringify(trophy)}`);
const expected = `window.leonidaCatalog = [\n${records.join(',\n')}\n];\n`;
if (catalog.trophies.length !== 55 || browserCatalog !== expected) {
  throw new Error('The browser catalog must match the 55 canonical trophies. Run node scripts/sync-catalog.mjs.');
}

mkdirSync(out, { recursive: true });
for (const directory of ['app', 'screenshots']) {
  cpSync(join(here, directory), join(out, directory), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
