import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(root, 'app.microi.form-engine.json');
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const scripts = {
  AsyncIndex: `V8.ApiEngine.Run('platform-search-engine', {
  Action: 'AsyncIndex',
  TableId: V8.Form.Id
}).then(function(result) {
  V8.Tips(result.Code === 1 ? '成功' : '失败：' + result.Msg, result.Code === 1)
})`,
  AsyncTableDataToIndex: `V8.ApiEngine.Run('platform-search-engine', {
  Action: 'AsyncTableDataToIndex',
  TableId: V8.Form.Id
}).then(function(result) {
  V8.Tips(result.Code === 1 ? '成功' : '失败：' + result.Msg, result.Code === 1)
})`
};

let changedButtons = 0;
function visit(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'MoreBtns' && typeof child === 'string' && child.trim().startsWith('[')) {
      const buttons = JSON.parse(child);
      for (const button of buttons) {
        const name = String(button._RawName || button.Name || '').toLowerCase();
        if (name === '同步es结构') {
          if (button.V8Code !== scripts.AsyncIndex) changedButtons += 1;
          button.V8Code = scripts.AsyncIndex;
        }
        if (name === '同步es数据') {
          if (button.V8Code !== scripts.AsyncTableDataToIndex) changedButtons += 1;
          button.V8Code = scripts.AsyncTableDataToIndex;
        }
      }
      value[key] = JSON.stringify(buttons);
    } else {
      visit(child);
    }
  }
}
visit(packageData);

if (!changedButtons && JSON.stringify(packageData).includes('/api/SearchEngine/')) {
  throw new Error('仍存在未迁移的 SearchEngine Controller 路由。');
}

const history = '2026-08-24 v7.6.4 表单设计器的 ES 结构/数据同步改为调用 Managed 接口引擎 platform-search-engine，移除对 SearchEngineController 的依赖。';
packageData.PackageInfo.Version = 'v7.6.4';
packageData.PackageInfo.Description = '表单引擎基础资源。设计器搜索索引维护统一调用应用商城 Managed 接口引擎；导入继续支持完整预览、UTF-8/GBK CSV、错误事务策略和唯一规则新增/修改。';
if (!String(packageData.PackageInfo.ChangeHistory || '').split(/\r?\n/).includes(history)) {
  packageData.PackageInfo.ChangeHistory = `${history}\n${packageData.PackageInfo.ChangeHistory || ''}`;
}
const capabilities = packageData.PackageInfo.RequiredPlatformCapabilities ||= [];
if (!capabilities.includes('ApiEngine:platform-search-engine')) {
  capabilities.push('ApiEngine:platform-search-engine');
}

fs.writeFileSync(packagePath, `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
console.log(`updated ${path.basename(packagePath)}; changedButtons=${changedButtons}`);
