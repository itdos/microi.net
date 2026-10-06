import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlatformServiceRouteSnapshots } from './platform-service-route-snapshot.mjs';

test('online and offline routes retain the authored anonymous signup and source metadata', () => {
  const [route] = buildPlatformServiceRouteSnapshots([{path:'/saas-trial',name:'saas-trial',title:'开通试用',SourceFile:'src/SaasPublicTrial.vue',RouteMetaJson:{Anonymous:true}}]);
  assert.equal(route.RoutePath,'/saas-trial');
  assert.equal(route.PageKey,'saas-trial');
  assert.equal(route.IsEnable,1);
  assert.deepEqual(JSON.parse(route.RouteMetaJson),{Anonymous:true,SourceFile:'src/SaasPublicTrial.vue'});
});
test('route upgrades retain tenant portable metadata and discard only the prior v3 release stamp', () => {
  const [route] = buildPlatformServiceRouteSnapshots([{path:'/existing',name:'existing'}],[{RoutePath:'/existing',RouteMetaJson:JSON.stringify({LegacyComponentPaths:['/legacy'],SourceFile:'src/Existing.vue',_MicroiV3:{old:true}})}]);
  assert.deepEqual(JSON.parse(route.RouteMetaJson),{LegacyComponentPaths:['/legacy'],SourceFile:'src/Existing.vue'});
});
test('route snapshots reject query, fragment and path separator injection', () => {
  for(const path of ['/saas-trial?src=other','/saas-trial#other','/saas\\trial','relative'])
    assert.throws(()=>buildPlatformServiceRouteSnapshots([{path}]));
});
