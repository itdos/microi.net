import assert from 'node:assert/strict';
import test from 'node:test';
import {diskGuardBinding,diskGuardMount} from '../../Microi.Panel/Tests/disk-guard-fixture.mjs';
test('native acceptance mounts the real read-only host socket',()=>{
 assert.deepEqual(diskGuardMount(()=>{throw Error('unexpected Docker call');},{}),['--mount','type=bind,source=/run/microi-disk-guard,target=/run/microi-disk-guard,readonly']);
});
const env={PANEL_TEST_DISK_SOCKET_VOLUME:'panel-disk-fixture-socket',PANEL_TEST_DISK_OWNER:'panel-disk-fixture-owner'};
test('Desktop acceptance binds only the explicitly owned real daemon volume',()=>{
 const docker=args=>{assert.deepEqual(args,['volume','inspect',env.PANEL_TEST_DISK_SOCKET_VOLUME]);return JSON.stringify([{Name:env.PANEL_TEST_DISK_SOCKET_VOLUME,Labels:{'io.microi.panel.diskfixture':env.PANEL_TEST_DISK_OWNER}}]);};
 assert.deepEqual(diskGuardBinding(docker,env),{type:'volume',source:env.PANEL_TEST_DISK_SOCKET_VOLUME,target:'/run/microi-disk-guard',read_only:true});
});
test('foreign disk fixture ownership is rejected before a controller starts',()=>{
 assert.throws(()=>diskGuardBinding(()=>JSON.stringify([{Name:env.PANEL_TEST_DISK_SOCKET_VOLUME,Labels:{'io.microi.panel.diskfixture':'another-owner'}}]),env),/ownership mismatch/);
});
test('partial or path-like disk fixture parameters are rejected',()=>{
 for(const value of [{PANEL_TEST_DISK_OWNER:env.PANEL_TEST_DISK_OWNER},{...env,PANEL_TEST_DISK_SOCKET_VOLUME:'/var/run/docker.sock'},{...env,PANEL_TEST_DISK_OWNER:'bad,readonly=false'}])assert.throws(()=>diskGuardMount(()=>{throw Error('must reject before Docker');},value),/Explicit disk fixture/);
});
