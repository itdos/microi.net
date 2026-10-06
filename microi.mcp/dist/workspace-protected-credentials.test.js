import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readWorkspaceCredentials, protectSessionToken, unprotectSessionToken } from './workspace-protected-credentials.js';
const macWorkspaceService = 'net.microi.cli.workspace.v1';
const macAccountFor = (filePath, key) => createHash('sha256')
    .update(`${path.join(path.dirname(filePath), '.microi-mcp-tokens.json')}\0${key}`).digest('hex');
/** 仅当前单测替代OS provider；精确核验两个profile键，不读取真实用户保险库。 */
function stubMacWorkspace(t, filePath, values, unavailable = false) {
    const expected = new Map(Object.entries(values).map(([key, value]) => [macAccountFor(filePath, key), value]));
    const calls = [];
    const replacement = ((command, args) => {
        assert.equal(command, '/usr/bin/security');
        assert.equal(args.length, 6);
        assert.deepEqual(args.slice(0, 3), ['find-generic-password', '-s', macWorkspaceService]);
        assert.equal(args[3], '-a');
        assert.match(args[4], /^[a-f0-9]{64}$/);
        assert.equal(args[5], '-w');
        calls.push(args[4]);
        const value = expected.get(args[4]), status = unavailable || value === undefined ? 44 : 0;
        const stdout = status === 0 ? Buffer.from(value, 'utf8').toString('base64') : '';
        return { pid: 0, output: [null, stdout, ''], stdout, stderr: '', status, signal: null };
    });
    t.mock.method(childProcess, 'spawnSync', replacement);
    return calls;
}
function vaultFixture() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-vault-test-'));
    const filePath = path.join(directory, 'vault.json');
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, protection: 'windows-dpapi-current-user', ciphertext: Buffer.from('opaque-ciphertext').toString('base64') }));
    return { directory, filePath };
}
test('imported developer session encrypts for the current OS user and never silently downgrades', () => {
    // 唯一自有fixture；finally只删本次service/account。
    const token = `fixture.session.${randomBytes(16).toString('hex')}.signature`;
    if (process.platform !== 'win32' && process.platform !== 'darwin') {
        assert.throws(() => protectSessionToken(token));
        return;
    }
    const account = createHash('sha256').update(token).digest('hex');
    try {
        const encrypted = protectSessionToken(token);
        assert.ok(encrypted.startsWith(process.platform === 'darwin' ? 'keychain-session-v1:' : 'dpapi-session-v1:'));
        assert.ok(!encrypted.includes(token));
        assert.equal(unprotectSessionToken(encrypted), token);
        assert.equal(unprotectSessionToken('legacy-token'), 'legacy-token');
        assert.throws(() => unprotectSessionToken('dpapi-session-v1:corrupt'));
    }
    finally {
        if (process.platform === 'darwin') {
            const deleted = childProcess.spawnSync('/usr/bin/security', ['delete-generic-password', '-s', 'net.microi.cli.session.v1', '-a', account], { encoding: 'utf8', timeout: 15_000 });
            assert.equal(deleted.error, undefined);
            assert.ok(deleted.status === 0 || deleted.status === 44, 'only owned fixture item may be deleted or already absent');
            const after = childProcess.spawnSync('/usr/bin/security', ['find-generic-password', '-s', 'net.microi.cli.session.v1', '-a', account], { encoding: 'utf8', timeout: 15_000 });
            assert.equal(after.status, 44, 'exact owned fixture item is absent after cleanup');
        }
    }
});
test('workspace credential vault returns only the requested encrypted profile keys', (t) => {
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
    const calls = process.platform === 'darwin' ? stubMacWorkspace(t, filePath, { 'user-key': 'workspace-user', 'password-key': 'workspace-password', 'other-password-key': 'must-not-be-selected' }) : undefined;
    let dpapiCalls = 0;
    try {
        const credentials = readWorkspaceCredentials({
            filePath,
            usernameKey: 'user-key',
            passwordKey: 'password-key',
        }, ciphertext => { dpapiCalls++; assert.deepEqual(ciphertext, Buffer.from('opaque-ciphertext')); return document; });
        assert.deepEqual(credentials, {
            username: 'workspace-user',
            password: 'workspace-password',
        });
        if (calls) {
            assert.deepEqual(calls, [macAccountFor(filePath, 'user-key'), macAccountFor(filePath, 'password-key')]);
            assert.equal(dpapiCalls, 0, 'macOS uses its provider without DPAPI/plaintext fallback');
        }
        else
            assert.equal(dpapiCalls, 1);
    }
    finally {
        t.mock.restoreAll();
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
    }
    finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
test('workspace credential provider unavailable fails closed without alternate profile or decoder fallback', (t) => {
    const { directory, filePath } = vaultFixture();
    const values = { 'user-key': 'workspace-user', 'password-key': 'workspace-password' };
    const calls = process.platform === 'darwin' ? stubMacWorkspace(t, filePath, values, true) : undefined;
    let dpapiCalls = 0;
    try {
        assert.equal(readWorkspaceCredentials({ filePath, usernameKey: 'user-key', passwordKey: 'password-key' }, () => {
            dpapiCalls++;
            throw new Error('owned provider fixture unavailable');
        }), undefined);
        if (calls) {
            assert.deepEqual(calls, [macAccountFor(filePath, 'user-key')]);
            assert.equal(dpapiCalls, 0);
        }
        else
            assert.equal(dpapiCalls, 1);
    }
    finally {
        t.mock.restoreAll();
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
test('workspace credential vault missing requested profile never selects another available password', (t) => {
    const { directory, filePath } = vaultFixture();
    const values = { 'user-key': 'workspace-user', 'other-password-key': 'must-not-be-selected' };
    const calls = process.platform === 'darwin' ? stubMacWorkspace(t, filePath, values) : undefined;
    let dpapiCalls = 0;
    try {
        assert.equal(readWorkspaceCredentials({ filePath, usernameKey: 'user-key', passwordKey: 'missing-password-key' }, () => {
            dpapiCalls++;
            return Buffer.from(JSON.stringify({ version: 1, values }), 'utf8');
        }), undefined);
        if (calls) {
            assert.deepEqual(calls, [macAccountFor(filePath, 'user-key'), macAccountFor(filePath, 'missing-password-key')]);
            assert.equal(dpapiCalls, 0);
        }
        else
            assert.equal(dpapiCalls, 1);
    }
    finally {
        t.mock.restoreAll();
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
//# sourceMappingURL=workspace-protected-credentials.test.js.map