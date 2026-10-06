import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const directory=import.meta.dirname;
const contract=JSON.parse(fs.readFileSync(path.join(directory,'official-api-source-contract.json'),'utf8'));
if(contract.SchemaVersion!==1||contract.OfficialApiBase!=='https://api.itdos.com'||contract.OfficialOsClient!=='iTdos'||!Array.isArray(contract.Entries))throw Error('官方发行源码契约身份无效');
const entries=new Map();
for(const entry of contract.Entries){if(!entry||!entry.Key||entries.has(entry.Key)||!['CanonicalReleaseSource','SafeTenantHookTemplate'].includes(entry.SourceRole)||!['ApiEngine','FormEvent'].includes(entry.Kind)||!/^v\d+\.\d+\.\d+$/.test(entry.Version)||!/^[a-f0-9]{64}$/.test(entry.Sha256)||typeof entry.File!=='string'||!entry.File.endsWith('.js')||path.isAbsolute(entry.File)||entry.File.split(/[\\/]/).includes('..'))throw Error('官方发行源码声明无效或重复');entries.set(entry.Key,entry);}
export function officialApiSourcePath(key){const entry=entries.get(key);if(!entry)throw Error('官方源码契约未声明资源：'+key);const target=path.resolve(directory,entry.File),real=fs.realpathSync(target);if(!real.startsWith(directory+path.sep)||real!==target||!fs.statSync(target).isFile())throw Error('官方源码路径越界或不是声明文件：'+key);return target;}
// 内容摘要绑定声明的完整正文；找不到、错租户镜像、路径/版本漂移都不能自动择源。
export function readOfficialApiSource(key){const entry=entries.get(key),source=fs.readFileSync(officialApiSourcePath(key),'utf8');if(createHash('sha256').update(source).digest('hex')!==entry.Sha256||entry.SourceRole==='CanonicalReleaseSource'&&!source.includes('Version: '+entry.Version))throw Error('官方源码正文或版本与发行契约不符：'+key);if(entry.Kind==='ApiEngine'&&source.match(/ApiEngineKey\s*[:：]\s*([^\s]+)/)?.[1]!==key)throw Error('官方源码接口标识不符：'+key);if(entry.SourceRole==='SafeTenantHookTemplate'){let body=source.trimStart();while(body.startsWith('/*'))body=body.replace(/^\/\*[\s\S]*?\*\/\s*/,'');if(!source.includes('OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1')||!/^return\s*\{\s*Code\s*:\s*1\s*\};?\s*$/.test(body))throw Error('租户Hook不能携带母库个性化正文：'+key);}return source;}
export const officialApiSourceEntries=Object.freeze(contract.Entries.map(e=>Object.freeze({...e})));
