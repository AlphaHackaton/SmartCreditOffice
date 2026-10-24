// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateApi } from './gen-api.mjs';

const temporaryDirectories = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'smartcredit-openapi-'));
  temporaryDirectories.push(dir);
  return { dir, input: join(dir, 'openapi.json'), output: join(dir, 'schema.d.ts') };
}

describe('генерация контракта', () => {
  it('не создаёт типы без экспорта Dev 2', async () => {
    const { input, output } = await fixture();
    await expect(generateApi(input, output)).rejects.toThrow('Нужен docs/openapi.json от Dev 2');
    await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('создаёт типы из временной синтетической схемы', async () => {
    const { dir, input, output } = await fixture();
    await writeFile(input, JSON.stringify({
      openapi: '3.0.3', info: { title: 'Test-only schema', version: '1' }, paths: {},
      components: { schemas: { Sample: {
        type: 'object', required: ['amount', 'status'], properties: {
          amount: { type: 'string', format: 'decimal' }, status: { type: 'string', enum: ['DRAFT', 'SUBMITTED'] },
        },
      } } },
    }));
    await generateApi(input, output);
    const result = await readFile(output, 'utf8');
    expect(result).toContain('amount: string');
    expect(result).toContain('"DRAFT" | "SUBMITTED"');
    expect(result).toContain('automatically generated');
    expect((await readdir(dir)).some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it.each(['not json', JSON.stringify({ openapi: '2.0', info: { title: 'Invalid', version: '1' }, paths: {} })])('сохраняет прежний файл при некорректной схеме', async (schema) => {
    const { dir, input, output } = await fixture();
    await writeFile(input, schema);
    await writeFile(output, 'previous schema');
    await expect(generateApi(input, output)).rejects.toThrow();
    expect(await readFile(output, 'utf8')).toBe('previous schema');
    expect((await readdir(dir)).some((name) => name.endsWith('.tmp'))).toBe(false);
  });
});
