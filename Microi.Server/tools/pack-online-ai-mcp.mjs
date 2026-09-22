import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'microi.mcp');
const expectedPublish = path.join(root, 'Microi.Server/Microi.net.Api/bin/Release/publish');
const publish = path.resolve(process.argv[2] || '');
const verifyOnly = process.argv[2] === '--verify-only';
if (!verifyOnly && (publish !== expectedPublish || !fs.existsSync(path.join(publish, 'Microi.net.Api.dll')))) {
  throw new Error('AI MCP can only be packed into this workspace API publish directory');
}
const buildRoot = path.join(root, '.tmp', 'microi-ai-mcp-build');
fs.mkdirSync(buildRoot, { recursive: true });
const staging = fs.mkdtempSync(path.join(buildRoot, 'pack-'));
function npm(args) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: staging, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`npm ${args[0]} failed: ${result.status}`);
}
try {
  for (const file of ['package.json', 'package-lock.json', 'tsconfig.json']) {
    fs.copyFileSync(path.join(source, file), path.join(staging, file));
  }
  fs.cpSync(path.join(source, 'src'), path.join(staging, 'src'), { recursive: true });
  npm(['ci', '--ignore-scripts']);
  npm(['run', 'build']);
  npm(['prune', '--omit=dev', '--ignore-scripts']);
  if (!fs.existsSync(path.join(staging, 'dist/index.js')))
    throw new Error('The packaged MCP entry point is missing');
  if (verifyOnly) {
    console.log('Online AI MCP runtime reproducible build and production-dependency prune passed');
    process.exitCode = 0;
  } else {
  const destination = path.join(publish, 'ai-mcp');
  fs.mkdirSync(destination, { recursive: true });
  for (const name of ['package.json', 'dist', 'node_modules']) {
    fs.cpSync(path.join(staging, name), path.join(destination, name), { recursive: true, force: true });
  }
  if (!fs.existsSync(path.join(destination, 'dist/index.js')))
    throw new Error('The packaged MCP entry point is missing');
  console.log('Online AI MCP runtime packed into API publish output');
  }
} finally {
  // The generated staging path is always a direct child of the fixed workspace directory.
  if (path.dirname(staging) === buildRoot) fs.rmSync(staging, { recursive: true, force: true });
}
