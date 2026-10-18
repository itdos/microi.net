import test from 'node:test';
import assert from 'node:assert/strict';
import {getMicroAppAppearance} from '../src/utils/micro-app-appearance.js';
import {applyUiDensity} from '../src/utils/ui-density.js';

test('微服务外观快照传递真实密度、边角与开关，彼此独立',()=>{
    const root={dataset:{mciCornerStyle:'square',mciDisableGradient:'true',mciDisableShadow:'false'}};
    applyUiDensity(90,{persist:false});
    const first=getMicroAppAppearance(root);
    assert.equal(first.uiDensity.scale,90);
    assert.equal(first.uiDensity.variables['--mci-ui-control-height'],'25.2px');
    assert.equal(first.cornerStyle,'square');
    assert.equal(first.disableGradient,true);
    assert.equal(first.disableShadow,false);
    first.uiDensity.variables['--mci-ui-control-height']='999px';
    assert.equal(getMicroAppAppearance(root).uiDensity.variables['--mci-ui-control-height'],'25.2px');
    applyUiDensity(110,{persist:false});
    assert.equal(getMicroAppAppearance(root).uiDensity.scale,110);
    applyUiDensity(100,{persist:false});
});
