import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('./mci-tree-drag-sort.js',import.meta.url),'utf8');
const initial=()=>[
 {Id:'a',ParentId:'',Sort:3,ParentIds:'',HasChild:1},
 {Id:'b',ParentId:'',Sort:77,ParentIds:'',HasChild:1},
 {Id:'a1',ParentId:'a',Sort:5,ParentIds:'a',HasChild:1},
 {Id:'a2',ParentId:'a',Sort:50,ParentIds:'a',HasChild:0},
 {Id:'a11',ParentId:'a1',Sort:1,ParentIds:'a,a1',HasChild:0},
 {Id:'b1',ParentId:'b',Sort:42,ParentIds:'b',HasChild:0}
];
function host(rows=initial(),options={}) {
 let data=structuredClone(rows),lastSql='',updates=[];
 function run(request){let staged=structuredClone(data);const sandbox={V8:{Param:request,EncryptHelper:{Sha256Hex:s=>crypto.createHash('sha256').update(s).digest('hex')},DbTrans:{FromSql(sql){lastSql=sql;return{ToArray:()=>structuredClone(staged).sort((a,b)=>a.Id.localeCompare(b.Id))}}},Method:{TreeMutationClientOperation(input){
  if(input.Action==='Context')return{Code:1,Data:{TableName:'Biz_Tree',SortField:'Sort',ParentField:'ParentId',AncestorField:'ParentIds',HasChildrenField:'HasChild',DbType:options.provider||'MySql'}};
  updates=structuredClone(input.Rows);
  for(const update of input.Rows){if(options.denied===update.Id)return{Code:0,Msg:'NoAuth'};Object.assign(staged.find(row=>row.Id===update.Id),update)}
  return{Code:1};
 }}}};const result=JSON.parse(JSON.stringify(vm.runInNewContext('(function(){'+source+'})()',sandbox)));
  if(result.Code===1)data=staged;return result;
 }
 return{run,move(moved,target,position){const snapshot=run({Action:'Snapshot',MenuId:'menu'}).Data.Snapshot;return run({Action:'Move',MenuId:'menu',MovedId:moved,TargetId:target,Position:position,ExpectedSnapshot:snapshot})},get rows(){return data},get sql(){return lastSql},get updates(){return updates}};
}
test('同级拖动按间隔10重排全部兄弟节点',()=>{const h=host();assert.equal(h.move('a2','a1','Before').Code,1);assert.equal(h.rows.find(r=>r.Id==='a2').Sort,10);assert.equal(h.rows.find(r=>r.Id==='a1').Sort,20);assert.deepEqual(h.updates.map(r=>r.Id).sort(),['a1','a2']);});
test('跨级移动维护两组兄弟、父标记和完整子树祖先链',()=>{const h=host();assert.equal(h.move('a1','b','Inside').Code,1);const by=id=>h.rows.find(r=>r.Id===id);assert.equal(by('a1').ParentId,'b');assert.equal(by('a1').Sort,20);assert.equal(by('b1').Sort,10);assert.equal(by('a2').Sort,10);assert.equal(by('a11').ParentIds,'b,a1');assert.equal(by('a1').ParentIds,'b');assert.equal(by('a').HasChild,1);});
test('移出最后一个子级清空父标记并支持根级',()=>{const h=host();assert.equal(h.move('b1','','Root').Code,1);assert.equal(h.rows.find(r=>r.Id==='b').HasChild,0);assert.equal(h.rows.find(r=>r.Id==='b1').ParentId,'');assert.deepEqual(h.rows.filter(r=>!r.ParentId).map(r=>r.Sort).sort((a,b)=>a-b),[10,20,30]);});
test('旧库零Guid根节点参与统一同级重排',()=>{const rows=initial();rows[0].ParentId='00000000-0000-0000-0000-000000000000';rows[1].ParentId='0';const h=host(rows);assert.equal(h.move('b','a','Before').Code,1);assert.equal(h.rows.find(r=>r.Id==='b').Sort,10);assert.equal(h.rows.find(r=>r.Id==='a').Sort,20);});
test('循环、缺失父节点和非法位置不产生写入',()=>{const h=host();const before=structuredClone(h.rows);assert.equal(h.move('a','a11','Inside').Code,0);assert.equal(h.move('a','a','Before').Code,0);assert.equal(h.move('a','missing','Inside').Code,0);assert.equal(h.move('a','b','Unknown').Code,0);assert.deepEqual(h.rows,before);});
test('过期快照拒绝覆盖别人提交的排序',()=>{const h=host();const snapshot=h.run({MenuId:'menu'}).Data.Snapshot;h.move('b','a','Before');const current=structuredClone(h.rows);const r=h.run({MenuId:'menu',Action:'Move',MovedId:'a2',TargetId:'a1',Position:'Before',ExpectedSnapshot:snapshot});assert.equal(r.DataAppend.ReasonCode,'TREE_SNAPSHOT_CONFLICT');assert.deepEqual(h.rows,current);});
test('受影响的任一兄弟无编辑权限时整批事务回滚',()=>{const h=host(initial(),{denied:'a1'});const before=structuredClone(h.rows);assert.equal(h.move('a2','a1','Before').Code,0);assert.deepEqual(h.rows,before);});
test('只接受意图参数，宿主注入参数被忽略，禁止表名和身份覆盖',()=>{const h=host();assert.equal(h.run({MenuId:'menu',_DeviceId:'device',_RequestScheme:'https',_RequestHost:'local',TestParam1:'debug'}).Code,1);assert.equal(h.run({MenuId:'menu',TableName:'sys_user'}).Code,0);assert.equal(h.run({MenuId:'menu',TestParam1:{Level:9999}}).Code,0);});
for(const provider of ['MySql','SqlServer','PostgreSql','Oracle','DaMeng','Kingbase'])test(provider+' 使用限量锁定查询',()=>{const h=host(initial(),{provider});assert.equal(h.run({MenuId:'menu'}).Code,1);assert.match(h.sql,/20001/);assert.match(h.sql,/FOR UPDATE|UPDLOCK/);if(['Oracle','DaMeng'].includes(provider)){assert.match(h.sql,/ROWNUM <= 20001/);assert.doesNotMatch(h.sql,/FETCH FIRST/);}});
