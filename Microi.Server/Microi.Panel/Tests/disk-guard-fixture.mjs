import assert from 'node:assert/strict';

// 实装门禁使用宿主服务；Docker Desktop 使用已单独登记的真实守护进程卷。
// 两者都必须经过生产 Unix socket 协议，不能关闭拉取前的容量与回滚保护。
export function diskGuardBinding(docker,env=process.env){
 const volume=env.PANEL_TEST_DISK_SOCKET_VOLUME,owner=env.PANEL_TEST_DISK_OWNER;
 if(!volume&&!owner)return {type:'bind',source:'/run/microi-disk-guard',target:'/run/microi-disk-guard',read_only:true};
 assert(/^[a-z][a-z0-9-]{5,80}$/.test(volume||''),'Explicit disk fixture volume required');
 assert(/^[a-z][a-z0-9-]{5,80}$/.test(owner||''),'Explicit disk fixture owner required');
 const actual=JSON.parse(docker(['volume','inspect',volume]));
 assert.equal(actual.length,1);assert.equal(actual[0].Name,volume);
 assert.equal(actual[0].Labels?.['io.microi.panel.diskfixture'],owner,'Disk fixture volume ownership mismatch');
 return {type:'volume',source:volume,target:'/run/microi-disk-guard',read_only:true};
}
export function diskGuardMount(docker,env=process.env){
 const binding=diskGuardBinding(docker,env);
 return ['--mount',`type=${binding.type},source=${binding.source},target=${binding.target},readonly`];
}
