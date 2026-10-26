import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const frontend = new URL('../', import.meta.url);
const lock = JSON.parse(await readFile(new URL('package-lock.json', frontend), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('package.json', frontend), 'utf8'));
const direct = new Set([...Object.keys(manifest.dependencies), ...Object.keys(manifest.devDependencies)]);
const rows = Object.entries(lock.packages)
  .filter(([path]) => path)
  .map(([path, pkg]) => {
    const name = path.split('node_modules/').at(-1);
    const type = `${direct.has(name) ? 'прямая' : 'транзитивная'}, ${pkg.dev ? 'dev-only' : 'runtime'}`;
    return { name, version: pkg.version, license: pkg.license ?? 'UNKNOWN — проверить вручную', type };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const section = '## Frontend\n\nГенерация: `cd frontend && npm run notices`. Версии и лицензии из package-lock.json.\n'
  + 'Runtime включается в браузерную сборку; dev-only — инструменты разработки.\n\n'
  + '| Пакет | Версия | Лицензия | Назначение |\n|---|---|---|---|\n'
  + rows.map(({ name, version, license, type }) => `| [${name}](https://www.npmjs.com/package/${name}) | ${version} | ${license.replaceAll('|', '/')} | ${type} |`).join('\n') + '\n\n';
const target = new URL('../../THIRD_PARTY_NOTICES.md', import.meta.url);
const text = await readFile(target, 'utf8');
if (!text.includes('## Frontend\n') || !text.includes('## Локальные инструменты')) throw new Error('Не найдены границы раздела Frontend');
await writeFile(target, text.replace(/## Frontend\n[\s\S]*?(?=## Локальные инструменты)/, section));
console.log(`Обновлён ${fileURLToPath(target)}: ${rows.length} пакетов`);
