import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../app/data/trophies.json', import.meta.url), 'utf8'));
const records = data.trophies.map(trophy => `  ${JSON.stringify(trophy)}`);
const script = `window.leonidaCatalog = [\n${records.join(',\n')}\n];\n`;
writeFileSync(new URL('../app/data/catalog.js', import.meta.url), script);
