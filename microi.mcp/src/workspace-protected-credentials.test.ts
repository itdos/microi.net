import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readWorkspaceCredentials } from './workspace-protected-credentials.js';

test('workspace credential vault returns only the requested encrypted profile keys', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-vault-test-'));
  const filePath = path.join(directory, 'vault.json');
  const document = Buffer.from(JSON.stringify({
    version: 1,
    values: {
      'user-key': 'workspace-user',
      'password-key': 'workspace-password',
      'other-password-key': 'must-not-be-selected',
    },
  }), 'utf8');
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    protection: 'windows-dpapi-current-user',
    ciphertext: Buffer.from('opaque-ciphertext').toString('base64'),
  }));
  try {
    const credentials = readWorkspaceCredentials({
      filePath,
      usernameKey: 'user-key',
      passwordKey: 'password-key',
    }, () => document);
    assert.deepEqual(credentials, {
      username: 'workspace-user',
      password: 'workspace-password',
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('workspace credential vault fails closed for malformed or incomplete data', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-vault-test-'));
  const filePath = path.join(directory, 'vault.json');
  fs.writeFileSync(filePath, '{"version":1,"protection":"plain","ciphertext":"x"}');
  try {
    assert.equal(readWorkspaceCredentials({
      filePath,
      usernameKey: 'user-key',
      passwordKey: 'password-key',
    }, () => Buffer.from('{}')), undefined);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
