import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';

const source=await readFile(new URL('./ai-app-publish-store.js',import.meta.url),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
function declaration(name){const start=source.indexOf(`function ${name}(`);assert(start>=0);const next=source.indexOf('\nfunction ',start+1);assert(next>start);return source.slice(start,next);}
function publisher(){const context=vm.createContext({JSON,Object,String,V8:{EncryptHelper:{Sha256Hex:sha}}});vm.runInContext(['text','toArray','parseObject','sha256Hex','apiEngineMap','normalizeSha256Hashes','buildApiEngineResourcePolicies'].map(declaration).join('\n')+'\nfunction readStoredPackage(row){return parseObject(row&&row.AppPakcet,{});}',context);return(rows,policies,previous,publication={ApplicationType:'Web',PublisherType:'官方应用'})=>JSON.parse(JSON.stringify(context.buildApiEngineResourcePolicies(rows,policies,previous?{AppPakcet:JSON.stringify(previous)}:null,publication)));}
const policy={ApiEngines:{core:{UpgradePolicy:'Managed',Ownership:'Application'}}};

test('an engine upgrade and identical publish replay preserve the complete policy and snapshot hash',()=>{
 const publish=publisher(),old={SysApiEngines:[{ApiEngineKey:'core',ApiV8Code:'old-code'}],ResourcePolicies:{SchemaVersion:1,ApiEngines:{core:{Ownership:'Application',UpgradePolicy:'Managed',BaseHash:sha('old-code')}}}},incoming=[{ApiEngineKey:'core',ApiV8Code:'new-code'}];
 const first=publish(incoming,policy,old),second=publish(incoming,policy,{SysApiEngines:incoming,ResourcePolicies:first});
 assert.equal(first.ApiEngines.core.BaseHash,sha('old-code'));
 assert.deepEqual(second,first);
 assert.equal(sha(JSON.stringify(second)),sha(JSON.stringify(first)));
 const third=publish(incoming,policy,{SysApiEngines:incoming,ResourcePolicies:second});assert.deepEqual(third,first);
});

test('a later real source change advances the base and retains the older compatibility hash',()=>{
 const publish=publisher(),previous={SysApiEngines:[{ApiEngineKey:'core',ApiV8Code:'middle-code'}],ResourcePolicies:{SchemaVersion:1,ApiEngines:{core:{Ownership:'Application',UpgradePolicy:'Managed',BaseHash:sha('old-code')}}}},incoming=[{ApiEngineKey:'core',ApiV8Code:'next-code'}];
 const next=publish(incoming,policy,previous);assert.equal(next.ApiEngines.core.BaseHash,sha('middle-code'));assert.deepEqual(next.ApiEngines.core.CompatibleBaseHashes,[sha('old-code')]);assert.deepEqual(publish(incoming,policy,{SysApiEngines:incoming,ResourcePolicies:next}),next);
});

test('legacy missing or malformed bases use the actual previous source and then stabilize',()=>{
 for(const base of [undefined,'invalid','a'.repeat(63)]){const publish=publisher(),incoming=[{ApiEngineKey:'core',ApiV8Code:'unchanged'}],previous={SysApiEngines:incoming,ResourcePolicies:{ApiEngines:{core:{Ownership:'Application',UpgradePolicy:'Managed',BaseHash:base}}}};const first=publish(incoming,policy,previous);assert.equal(first.ApiEngines.core.BaseHash,sha('unchanged'));assert.deepEqual(publish(incoming,policy,{SysApiEngines:incoming,ResourcePolicies:first}),first);}
});

test('changed ownership or policy cannot reuse an unrelated preserved base',()=>{
 const publish=publisher(),incoming=[{ApiEngineKey:'core',ApiV8Code:'unchanged'}];
 for(const prior of [{Ownership:'Platform',UpgradePolicy:'Managed'},{Ownership:'Application',UpgradePolicy:'CreateIfMissing'}]){const previous={SysApiEngines:incoming,ResourcePolicies:{ApiEngines:{core:{...prior,BaseHash:sha('ancestor')}}}};assert.equal(publish(incoming,policy,previous).ApiEngines.core.BaseHash,sha('unchanged'));}
});

test('tenant CreateIfMissing hooks retain their separate policy and emit no baseline',()=>{
 const publish=publisher(),incoming=[{ApiEngineKey:'hook',ApiV8Code:'template'}],requested={ApiEngines:{hook:{UpgradePolicy:'CreateIfMissing',Ownership:'Tenant'}}};const first=publish(incoming,requested,{SysApiEngines:incoming,ResourcePolicies:{ApiEngines:{hook:{UpgradePolicy:'Managed',Ownership:'Platform',BaseHash:sha('old')}}}});assert.deepEqual(first.ApiEngines.hook,{Ownership:'Tenant',UpgradePolicy:'CreateIfMissing'});assert.deepEqual(publish(incoming,requested,{SysApiEngines:incoming,ResourcePolicies:first}),first);
});
