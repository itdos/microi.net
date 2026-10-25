import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
function regular(file,{directory=false,missing=false}={}){
 assert.ok(typeof file==='string'&&path.isAbsolute(file),'Browser fixture paths must be absolute.');
 let item=path.resolve(file);
 while(true){if(fs.existsSync(item))assert.ok(!fs.lstatSync(item).isSymbolicLink(),'Browser fixture paths cannot cross a reparse point.');else assert.ok(missing,'Browser fixture input is missing.');const parent=path.dirname(item);if(parent===item)break;item=parent;}
 if(fs.existsSync(file))assert.ok(directory?fs.statSync(file).isDirectory():fs.statSync(file).isFile(),'Browser fixture path has the wrong type.');
 else assert.ok(missing,'Browser fixture input is missing.');
 return file;
}
// Connection strings can contain quoted semicolons; never split a secret on ";".
export function parseFixtureConnection(text){
 assert.equal(typeof text,'string');const parts=[];let part='',quote='';
 for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c===quote){if(text[i+1]===quote){part+=c;i++;}else quote='';}else part+=c;}else if(c==='"'||c==="'")quote=c;else if(c===';'){parts.push(part);part='';}else part+=c;}
 assert.equal(quote,'','Unclosed fixture connection quote.');parts.push(part);const values={};
 for(const part of parts.filter(p=>p.trim())){const i=part.indexOf('=');assert.ok(i>0,'Malformed fixture connection.');const key=part.slice(0,i).trim().toLowerCase();assert.ok(!(key in values),'Duplicate fixture connection property.');values[key]=part.slice(i+1).trim();}
 const one=(aliases,required=true)=>{const keys=aliases.filter(k=>k in values);assert.ok(keys.length===(required?1:Math.min(1,keys.length)),'Ambiguous fixture connection property.');return keys.length?values[keys[0]]:undefined;};
 const host=one(['server','host','data source']),port=Number(one(['port'],false)||3306),database=one(['database','initial catalog']),user=one(['uid','user id','user','username']),password=one(['pwd','password']);
 assert.ok(['127.0.0.1','localhost','::1'].includes(host),'Fixture transport must be local.');assert.ok(Number.isInteger(port)&&port>0&&port<=65535,'Invalid fixture port.');assert.match(database,/^[A-Za-z0-9_]{1,64}$/);assert.ok(user&&password,'Fixture credentials are absent.');
 return {host,port,database,user,password};
}
export function buildBrowserFixtureConfig(scope,settings,osClient){
 assert.ok(typeof scope?.task==='string'&&scope.task&&typeof scope.authorization==='string'&&scope.authorization,'Existing fixture ownership and human authorization are required.');
 assert.ok(osClient&&settings?.OsClient===osClient,'Browser fixture tenant differs from the selected API.');
 assert.equal(String(settings.OsClientDbType).toLowerCase(),'mysql','Browser fixture requires its existing MySQL database.');
 const db=parseFixtureConnection(settings.OsClientDbConn);
 assert.ok(Array.isArray(scope.databases)&&scope.databases.includes(db.database),'API database is outside the authorized fixture scope.');
 for(const key of ['host','port','user','password'])assert.ok(String(db[key])===String(scope.mysql?.[key]),'API connection differs from the authorized fixture transport.');
 return {ownerTask:scope.task,authorization:scope.authorization,osClient,database:db.database,connection:{host:db.host,port:db.port,user:db.user,password:db.password,charset:'utf8mb4'}};
}
export function prepareBrowserFixtureConfig(workspaceRoot,results,environment,run=spawnSync){
 assert.equal(environment.MICROI_TEST_ALLOW_WRITES,'YES','Browser fixture requires explicit existing-fixture write authorization.');
 const python=regular(environment.MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON);
 const command=(exe,args,options={})=>{const r=run(exe,args,{encoding:'utf8',windowsHide:true,timeout:30000,...options});assert.ok(!r.error&&r.status===0,'Browser fixture private-input/ownership verification failed; no tests were started.');return r.stdout;};
 const aclScript="import importlib.util,pathlib,sys;s=importlib.util.spec_from_file_location('guard',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.verify_private_acl(pathlib.Path(sys.argv[2]))";
 const acl=file=>{regular(file,{directory:fs.statSync(file).isDirectory()});command(python,['-B','-c',aclScript,path.join(here,'fixtures/native-mysql-client.py'),file]);};
 let config=environment.PW_RICHTEXT_FIXTURE_CONFIG,created=false;
 if(config){regular(config);acl(config);acl(path.dirname(config));}
 else{
  const scopeFile=environment.MICROI_TEST_UI_FIXTURE_SCOPE,settingsFile=environment.MICROI_TEST_UI_FIXTURE_APPSETTINGS;
  assert.ok(scopeFile&&settingsFile,'Browser fixture needs PW_RICHTEXT_FIXTURE_CONFIG or existing MICROI_TEST_UI_FIXTURE_SCOPE and MICROI_TEST_UI_FIXTURE_APPSETTINGS; no tenant will be created.');
  regular(scopeFile);regular(settingsFile);acl(scopeFile);acl(settingsFile);
  const value=buildBrowserFixtureConfig(read(scopeFile),read(settingsFile).AppSettings,environment.MICROI_TEST_OSCLIENT);
  const directory=path.join(path.resolve(results),'browser-fixture-private');regular(directory,{directory:true,missing:true});assert.ok(!fs.existsSync(directory),'Browser fixture output already exists; preserve the previous attempt.');
  fs.mkdirSync(directory,{mode:0o700});created=true;
  if(process.platform==='win32'){
   const script="$p='"+directory.replaceAll("'","''")+"';$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=New-Object System.Security.AccessControl.DirectorySecurity;$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false);foreach($s in @($sid,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')))){$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($rule)};Set-Acl -LiteralPath $p -AclObject $acl";
   command('pwsh',['-NoProfile','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')]);
  }
  acl(directory);config=path.join(directory,'richtext-fixture.json');fs.writeFileSync(config,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});acl(config);
 }
 const value=read(config);
 assert.ok(value.osClient===environment.MICROI_TEST_OSCLIENT&&value.ownerTask&&value.authorization,'Existing rich-text fixture identity/authorization differs.');
 const targetFile=environment.MICROI_TEST_UI_FIXTURE_APPSETTINGS||environment.PW_APPSETTINGS_PATH;
 assert.ok(targetFile,'Browser fixture needs the selected API appsettings path to verify its exact target.');
 regular(targetFile);acl(targetFile);
 buildBrowserFixtureConfig({task:value.ownerTask,authorization:value.authorization,databases:[value.database],mysql:value.connection},read(targetFile).AppSettings,environment.MICROI_TEST_OSCLIENT);
 const helper=path.join(workspaceRoot,'Microi.Client/tests/helpers/richtext-fixture.py');
 const proof=JSON.parse(command(python,['-X','utf8','-B',regular(helper)],{input:JSON.stringify({config,osClient:environment.MICROI_TEST_OSCLIENT,action:'verify'})}));
 assert.equal(proof.ownerVerified,true,'Existing browser fixture owner verification did not pass.');
 return {environment:{PW_RICHTEXT_FIXTURE_CONFIG:config},receipt:{schemaVersion:1,source:created?'ExistingAuthorizedScope':'ExistingPrivateConfig',ownerVerified:true,createdTenant:false,createdContainer:false,configPath:config}};
}
