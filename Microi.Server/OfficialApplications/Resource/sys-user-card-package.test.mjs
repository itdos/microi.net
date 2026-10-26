import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readPackage = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const pkg = readPackage('./app.microi.sys_user.json');
const menu = pkg.SysMenus.find(item => item.Url === '/mic-sys-user');
const fieldName = item => typeof item === 'string' ? item : item?.Name;
const card = JSON.parse(menu.ViewSchema).Views.find(view => view.Scene === 'Card').Layout.Card;
const cardFields = () => [
    card.TitleField, card.AvatarField, card.AvatarTextField,
    ...['StatusFields', 'TopFields', 'SubtitleFields', 'RightFields', 'Fields', 'MetaFields', 'BottomFields']
        .flatMap(key => card[key] || []),
].map(fieldName).filter(Boolean);

test('系统账号卡片交付登录身份、联系方式、组织与授权信息，而非桌面偏好和密码信息', () => {
    assert.equal(card.TitleField, 'Name');
    assert.equal(card.AvatarField, 'Avatar');
    assert.ok(card.StatusFields.some(item => fieldName(item) === 'State'));
    assert.ok(card.TopFields.some(item => fieldName(item) === 'UserType'));
    assert.ok(card.SubtitleFields.some(item => fieldName(item) === 'Account' && item.ShowLabel === true));
    for (const name of ['Phone', 'Email', 'DeptName', 'RoleIds', 'Jobs']) {
        assert.ok(card.Fields.some(item => fieldName(item) === name && item.ShowLabel === true), `${name} 缺少可读卡片正文`);
    }
    assert.ok(card.BottomFields.some(item => fieldName(item) === 'TenantName'));
    assert.equal(card.HideIndex, true);
    assert.ok(Number(menu.ViewConfigVersion) >= 3);
    assert.ok(!cardFields().some(name => /pwd|password|secret|token|apikey/i.test(name)));
    assert.ok(!cardFields().some(name => ['OpenTreeMenu', 'RandomDesktopBg', 'GiteeStarVerified', 'DesktopType'].includes(name)));
});

test('卡片所有引用字段均属于系统账号元数据，角色与岗位继续通过选择控件显示可读值', () => {
    const table = pkg.DiyTables.find(item => item.Name.toLowerCase() === 'sys_user');
    const fields = pkg.DiyFields.filter(item => item.TableId === table.Id);
    for (const name of cardFields()) assert.ok(fields.some(item => item.Name === name), `卡片字段 ${name} 不在系统账号元数据内`);
    for (const name of ['RoleIds', 'Jobs']) {
        const field = fields.find(item => item.Name === name);
        assert.ok(['MultipleSelect', 'Select'].includes(field.Component), `${name} 不能作为裸 Id 文本显示`);
        assert.ok(field.Config && JSON.parse(field.Config), `${name} 缺少选项显示配置`);
    }
});

test('系统账号卡片菜单由系统账号应用唯一交付，不扩大 SaaS 或启动恢复菜单', () => {
    assert.equal(pkg.SysMenus.filter(item => item.Id === menu.Id).length, 1);
    for (const other of [
        readPackage('./app.microi.saas-engine.json'),
        readPackage('../../Microi.Upgrade/Resource/app.microi.bootstrap.json'),
    ]) assert.ok(!other.SysMenus.some(item => item.Id === menu.Id || item.Url === menu.Url));
});
