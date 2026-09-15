import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { platformEditionLabel, hideSystemLicenseVersion, mergeLoginSysConfig } from '../src/utils/platform-edition.js';
test('授权类型映射区分未授权、已授权与未知状态', () => {
    for (const value of ['', 'OpenSource', 'opensource']) assert.equal(platformEditionLabel(value), '开源版');
    assert.equal(platformEditionLabel('Personal'), '个人版');
    assert.equal(platformEditionLabel('Enterprise'), '企业版');
    for (const value of [undefined, null, 'invalid']) assert.equal(platformEditionLabel(value), '');
});
test('隐藏授权版本默认关闭，兼容数据库布尔序列化', () => {
    for (const value of [undefined, null, false, 0, '0', 'false']) assert.equal(hideSystemLicenseVersion({ HideSystemLicenseVersion: value }), false);
    for (const value of [true, 1, '1', 'true']) assert.equal(hideSystemLicenseVersion({ HideSystemLicenseVersion: value }), true);
});
test('旧登录响应覆盖配置时保留当前连接的公开授权版本，不合并其它旧设置', () => {
    const bootstrap = { PlatformEdition: '企业版', SysTitle: '启动标题', OldSetting: '旧设置' };
    const login = { SysTitle: '用户标题', HideSystemLicenseVersion: 1 };
    assert.deepEqual(mergeLoginSysConfig(bootstrap, login), { ...login, PlatformEdition: '企业版' });
    assert.equal(login.PlatformEdition, undefined);
    assert.equal(bootstrap.SysTitle, '启动标题');
});
test('新登录响应的明确版本优先，空字符串保留未授权语义', () => {
    for (const value of ['Personal', '开源版', '']) {
        assert.equal(mergeLoginSysConfig({ PlatformEdition: '企业版' }, { PlatformEdition: value }).PlatformEdition, value);
    }
});
test('没有可信启动版本时不把未知版本改成开源版', () => {
    for (const value of [undefined, null, 'invalid']) {
        assert.deepEqual(mergeLoginSysConfig({ PlatformEdition: value }, { SysTitle: '标题' }), { SysTitle: '标题' });
    }
    assert.deepEqual(mergeLoginSysConfig({}, {}), {});
});
test('存量登录的空授权字段使用当前启动版本，明确的异常版本不被掩盖', () => {
    assert.equal(mergeLoginSysConfig({ PlatformEdition: 'Personal' }, { PlatformEdition: null }).PlatformEdition, 'Personal');
    assert.equal(mergeLoginSysConfig({ PlatformEdition: 'Personal' }, { PlatformEdition: 'future-edition' }).PlatformEdition, 'future-edition');
});
test('真实登录完成路径先合并运行态授权版本再写入 Pinia', () => {
    const source = fs.readFileSync(new URL('../src/views/login/index.vue', import.meta.url), 'utf8');
    assert.match(source, /setSysConfig\(mergeLoginSysConfig\(self\.diyStore\.SysConfig, self\.LoginResult\.DataAppend\.SysConfig\)\)/);
});
