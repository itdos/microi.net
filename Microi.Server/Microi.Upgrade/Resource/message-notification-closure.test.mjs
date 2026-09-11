import test from 'node:test';
import assert from 'node:assert/strict';
import {getMessageNotificationContractKeys} from './resource-sync-core.mjs';

test('统一通知包不能通过同时缺失提醒表和配置接口绕过完整交付',()=>{
 const legacy=getMessageNotificationContractKeys({});assert.equal(legacy.length,7);
 const expected=legacy.concat(['platform-reminder-runtime','platform-reminder-official-feed','platform-reminder-tick','platform-message-notification-config']);
 for(const input of [
  {PackageInfo:{Version:'v1.0.19'}},
  {PackageInfo:{Version:'v1.1.0'}},
  {PackageInfo:{Version:'v1.0.18'},SysApiEngines:[{ApiEngineKey:'platform-message-notification-config'}]},
 ])assert.deepEqual(getMessageNotificationContractKeys(input),expected);
 assert.deepEqual(getMessageNotificationContractKeys({PackageInfo:{Version:'v1.0.18'}}),legacy);
 assert.equal(getMessageNotificationContractKeys({PackageInfo:{Version:'v1.0.18'},DiyTables:[{Name:'mci_platform_reminder'}]}).length,10);
});
