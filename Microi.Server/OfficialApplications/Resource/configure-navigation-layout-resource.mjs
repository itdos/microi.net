import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes('--check');
if (process.argv.includes('--sync-base')) throw new Error('共同基线只允许同步器在发布回读后推进。');
const source = fs.readFileSync(path.join(directory, 'platform-user-update-preferences.js'), 'utf8');
const engineVersion = source.match(/Version:\s*(v[\d.]+)/)?.[1];
if (!engineVersion) throw new Error('个人偏好接口缺少版本。');
const content = '新增顶部 + 侧边导航：一级位于顶部，二级复用主题侧栏和收起/展开设置；个人和租户默认可保存 TopSide。个人中心与框架修改密码弹窗使用同一安全流程。';
const reports = [];
for (const name of ['sys_user', 'sys-config', 'saas-engine']) {
    const filename = `app.microi.${name}.json`;
    const file = path.join(directory, filename);
    const before = fs.readFileSync(file, 'utf8');
    const model = JSON.parse(before);
    const fields = model.DiyFields.filter(field => field.Name === 'NavigationLayout' && ['sys_user', 'sys_config'].includes(String(field.TableName).toLowerCase()));
    if (!fields.length) throw new Error(`${filename} 缺少 NavigationLayout 元数据，禁止凭空猜测表和字段身份。`);
    for (const field of fields) {
        const options = JSON.parse(field.Data || '[]');
        if (!options.some(option => option.Key === 'TopSide')) options.push({ Key:'TopSide', Value:'顶部 + 侧边导航' });
        field.Data = JSON.stringify(options);
        field.Description = String(field.TableName).toLowerCase() === 'sys_user'
            ? '当前账号跨设备导航布局偏好；空值或 System 跟随租户设置。TopSide 将一级放顶部，二级放侧栏，无子级时不显示侧栏。'
            : '经典桌面导航支持 Side、Top、TopSide；TopSide 将一级放顶部，二级复用侧栏展开和收起方式，无子级时隐藏侧栏。移动端仍为底部导航。';
    }
    if (name === 'sys_user') {
        const engines = model.SysApiEngines.filter(engine => engine.ApiEngineKey === 'platform-user-update-preferences');
        if (engines.length !== 1) throw new Error('系统账号必须唯一拥有个人偏好 Managed 接口。');
        engines[0].ApiV8Code = source;
        engines[0].Version = engineVersion;
    }
    // 只覆盖包拥有的字段定义及接口，不触碰 DataSets 中的租户配置或共同同步基线。
    const changed = JSON.stringify(model) !== JSON.stringify(JSON.parse(before));
    if (changed && check) throw new Error(`${filename} 尚未同步当前导航枚举/个人偏好源码。`);
    if (changed) {
        const parts = String(model.PackageInfo.Version).replace(/^v/, '').split('.').map(Number);
        parts[parts.length - 1] += 1;
        const version = 'v' + parts.join('.');
        model.PackageInfo.Version = version;
        model.PackageInfo.ChangeHistory = `2026-10-09 ${version} ${content}\n${model.PackageInfo.ChangeHistory || ''}`;
        model.PackageInfo.ChangeLog = { Version:version, Title:'导航布局与账号安全入口完善', ChangeType:'Feature', Content:content, ReleaseTime:'2026-10-09 12:00:00' };
        fs.writeFileSync(file, JSON.stringify(model, null, 2) + '\n');
    }
    reports.push({ file:filename, changed, version:model.PackageInfo.Version, fields:fields.map(field => ({ Id:field.Id, TableName:field.TableName, Name:field.Name })) });
}
console.log(JSON.stringify({ check, reports }, null, 2));
