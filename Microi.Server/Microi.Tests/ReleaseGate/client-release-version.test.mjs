import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = fs.readFileSync(path.join(root, 'Microi一键编译发布.sh'), 'utf8');
const reader = source.slice(source.indexOf('json_value() {'), source.indexOf('# 自动递增版本号'));
const begin = source.indexOf('# 前后端可以分别发布。');
const end = source.indexOf('# 选定版本已准备；', begin);
const loopStart = source.indexOf('    for _plan in "${SELECTED_CLIENT_PLANS[@]}"; do', end);
const loopEnd = source.indexOf('    done', loopStart) + '    done'.length;
const gitExec = process.platform === 'win32' ? execFileSync('git', ['--exec-path'], {encoding:'utf8'}).trim() : '';
const bash = process.platform === 'win32' ? path.resolve(gitExec, '../../..', 'bin/bash.exe') : 'bash';

// 回放真正的版本读取和推送分支，避免仅检查变量名却未发现取值或参数次序错误。
for (const row of [
    {name:'PC only keeps the newer PC version', client:'8.5.12', backend:'8.5.11'},
    {name:'unified release keeps both component versions', client:'8.5.12', backend:'8.5.12'},
    {name:'push-only uses the existing PC artifact source version', client:'8.5.12', backend:'8.5.11', build:false},
    {name:'invalid PC version refuses push', client:'not-a-version', backend:'8.5.11', denied:true},
    {name:'missing PC version refuses push', backend:'8.5.11', denied:true}
]) test(row.name, () => {
    assert.ok(begin >= 0 && end > begin && loopStart > end && loopEnd > loopStart);
    const parent = path.join(root, '.tmp');
    fs.mkdirSync(parent, {recursive:true});
    const directory = fs.mkdtempSync(path.join(parent, 'client-release-version-'));
    try {
        fs.mkdirSync(path.join(directory, 'Microi.Client'));
        const packageFile = path.join(directory, 'Microi.Client/package.json');
        const bytes = JSON.stringify({name:'fixture', ...(row.client ? {version:row.client} : {})});
        fs.writeFileSync(packageFile, bytes);
        const run = spawnSync(bash, ['--noprofile','--norc','-s'], {cwd:directory, encoding:'utf8', input:`
set -e
print_info(){ :; }
print_fail(){ printf '%s\\n' "$*" >&2; exit 17; }
docker_push_plan(){ printf 'PUSH=%s:%s\\n' "$1" "$2"; }
VERSION='${row.backend}'
BUILD_CLIENT=${row.build === false ? 'false' : 'true'}
SELECTED_CLIENT_PLANS=('fixture-client')
${reader}
${source.slice(begin,end)}
${source.slice(loopStart,loopEnd)}
`});
        assert.equal(run.status, row.denied ? 17 : 0, run.stderr);
        assert.equal(run.stdout.trim(), row.denied ? '' : `PUSH=fixture-client:${row.client}`);
        assert.equal(fs.readFileSync(packageFile, 'utf8'), bytes, 'same-version release must not rewrite package.json');
    } finally {
        // 只回收本用例刚创建的独占目录，成功与失败共用同一收尾。
        assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(parent));
        fs.rmSync(directory, {recursive:true});
        assert.equal(fs.existsSync(directory), false);
    }
});
