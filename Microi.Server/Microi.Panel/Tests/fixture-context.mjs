import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// 每轮旧协议回归使用独立名称和目录。禁止再复用历史日期标签清理另一轮容器。
export const run=process.env.PANEL_LEGACY_RUN_ID;
assert(/^[a-z][a-z0-9-]{5,48}$/.test(run||''),'Run the Panel specialist gate or set a unique PANEL_LEGACY_RUN_ID');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
export const work=resolve(root,'.tmp/panel-acceptance',run);
export const image=process.env.PANEL_TEST_IMAGE;
assert(image,'PANEL_TEST_IMAGE must name the actual candidate under acceptance');
export const names={ops:run+'-controller',api:run+'-api',web:run+'-web',bootstrap:run+'-bootstrap',registry:run+'-registry',proxy:run+'-proxy',watchtower:run+'-watchtower'};
export const network=run+'-network';
export const label='io.microi.ops.test='+run;
export const fixtureRepository=run+'-fixture';
export const fixtureImage=version=>fixtureRepository+':'+version;
