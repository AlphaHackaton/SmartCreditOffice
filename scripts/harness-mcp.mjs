// Dependency-free, stdio MCP adapter for the repository's existing checks.
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tools = [
  {
    name: 'harness_check',
    description: 'Run full SmartCreditOffice verification. Only exit 0 means success.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'harness_quick_check',
    description: 'Run the quick check after editing a project file.',
    inputSchema: {
      type: 'object', properties: { path: { type: 'string' } },
      required: ['path'], additionalProperties: false,
    },
  },
];

function runCheck(script, args) {
  return new Promise((resolveResult) => {
    let output = '';
    const child = spawn('bash', [script, ...args], { cwd: root });
    const append = (chunk) => { output = (output + chunk.toString()).slice(-24000); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => { append('\nCheck timed out'); child.kill('SIGTERM'); }, 600000);
    child.on('error', (error) => { append(error.message); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveResult({
        content: [{ type: 'text', text: `exit ${code ?? 1}\n${output}` }],
        isError: code !== 0,
      });
    });
  });
}

async function handle(message) {
  if (message.id === undefined) return;
  const reply = (result) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, result })}\n`);
  const fail = (code, text) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code, message: text } })}\n`);
  try {
    if (message.method === 'initialize') {
      reply({ protocolVersion: message.params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'smartcredit-harness', version: '1.0.0' } });
    } else if (message.method === 'ping') {
      reply({});
    } else if (message.method === 'tools/list') {
      reply({ tools });
    } else if (message.method === 'tools/call') {
      const { name, arguments: args = {} } = message.params ?? {};
      if (name === 'harness_check') reply(await runCheck('scripts/check.sh', []));
      else if (name === 'harness_quick_check') {
        if (typeof args.path !== 'string' || !args.path) throw new Error('path is required');
        const file = resolve(root, args.path);
        const rel = relative(root, file);
        if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new Error('path must be inside the project');
        const result = await runCheck('scripts/quick-check.sh', [file]);
        result.content[0].text = `[harness quick-check] ${result.isError ? 'FAIL' : 'OK'} (${rel})\n${result.content[0].text}`;
        reply(result);
      } else fail(-32602, 'Unknown tool');
    } else fail(-32601, 'Method not found');
  } catch (error) { fail(-32602, error.message); }
}

let pending = Promise.resolve();
createInterface({ input: process.stdin }).on('line', (line) => {
  pending = pending.then(async () => {
    try { await handle(JSON.parse(line)); }
    catch { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`); }
  });
});
