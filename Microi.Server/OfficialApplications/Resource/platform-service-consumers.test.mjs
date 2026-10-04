import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
const dir=import.meta.dirname;
const bundle=p=>(p.ApplicationBundles||[]).find(x=>x.Application?.AppKey==='microi-platform-service');
test('所有平台应用的共享微服务必须与唯一运行包一致，防止安装顺序使消息通知退版',async()=>{
  const contract=JSON.parse(await fs.readFile(path.join(dir,'platform-service-release.json'),'utf8'));
  assert.ok(contract.PackageTargets.some(x=>x.endsWith('/app.microi.sys-log.json')),'系统日志/监控必须进入共享运行包发布闭包');
  const canonical=bundle(JSON.parse(await fs.readFile(path.join(dir,'app.microi.saas-engine.json'),'utf8')));
  for(const name of (await fs.readdir(dir)).filter(x=>/^app\..*\.json$/.test(x))){
    const p=JSON.parse(await fs.readFile(path.join(dir,name),'utf8')),b=bundle(p);if(!b)continue;
    assert.ok(contract.PackageTargets.some(x=>x.endsWith('/'+name)),name+' 未声明共享运行包发布目标');
    assert.equal(b.VersionNo,canonical.VersionNo,name+' 运行版本漂移');
    assert.equal(b.MicroService.DistHash,canonical.MicroService.DistHash,name+' 构建内容漂移');
    assert.deepEqual(b.BuildAssets,canonical.BuildAssets,name+' 运行资产漂移');
    assert.deepEqual(b.Routes,canonical.Routes,name+' 路由漂移');
    assert.equal(b.IncludeSource,false,name+' 不能安装历史可编辑源码覆盖共用应用');
  }
});
