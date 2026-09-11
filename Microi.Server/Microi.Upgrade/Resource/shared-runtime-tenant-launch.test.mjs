import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./import-package.js',import.meta.url),'utf8');
const start=source.indexOf('    var buildSharedApplicationLaunchUrl = function');
const end=source.indexOf('\n    };',start)+7;
assert.ok(start>=0&&end>start);
const helper=source.slice(start,end);
const entry='https://cdn.example.com/assets/releases/v1.2.3/index.html';
function launch(apiBase,tenant){const scope={V8:{SysConfig:{ApiBase:apiBase},OsClient:tenant},firstTextParam:items=>items.find(x=>String(x||'').trim())||''};vm.runInNewContext(helper+';result=buildSharedApplicationLaunchUrl('+JSON.stringify(entry)+');',scope);return scope.result;}
test('shared runtime URL binds target tenant without changing immutable asset path',()=>{
 const url=new URL(launch('https://target.example.com/v2/','tenant-b'));
 assert.equal(url.origin+url.pathname,entry);assert.equal(url.searchParams.get('apiBase'),'https://target.example.com/v2');assert.equal(url.searchParams.get('OsClient'),'tenant-b');
 assert.deepEqual([...url.searchParams.keys()],['apiBase','OsClient']);
 assert.match(source,/var previewUrl = useSharedPublicBuild\s*\? buildSharedApplicationLaunchUrl\(sharedEntryUrl\)/);
});
test('shared runtime launch supports tenant-owned HTTP and rejects missing or credential-bearing context',()=>{
 assert.equal(new URL(launch('http://localhost:61501','tenant-b')).searchParams.get('apiBase'),'http://localhost:61501');
 for(const value of ['', 'https://a:b@example.com','javascript:alert(1)','https://api.example.com/?token=x','https://api.example.com/#x','https://api.example.com\n'])assert.throws(()=>launch(value,'tenant-b'));
 for(const tenant of ['', '../other','other&OsClient=publisher'])assert.throws(()=>launch('https://target.example.com',tenant));
});
