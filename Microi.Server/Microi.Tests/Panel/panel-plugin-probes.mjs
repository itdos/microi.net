import assert from 'node:assert/strict';
import {s3Request} from './panel-s3.mjs';

export function createPluginProbe({docker,servicePort}) {
const s3=(method,path,body,password)=>s3Request(servicePort,password,method,path,body);
const mysqlSql=(name,sql)=>docker(['exec','-i',name,'sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=TCP -h127.0.0.1 -uroot -N -B microi'],{input:sql});
const pgSql=(name,sql)=>docker(['exec','-i',name,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At'],{input:sql});
const msSql=(name,sql)=>docker(['exec','-i',name,'sh','-c','SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; export SQLCMDPASSWORD; p=/opt/mssql-tools18/bin/sqlcmd; [ -x "$p" ] || p=/opt/mssql-tools/bin/sqlcmd; exec "$p" -S localhost -U sa -C -b -h -1 -W'],{input:sql+'\nGO\n'});
const oracleSql=(name,sql)=>docker(['exec','-i',name,'bash','-lc','exec sqlplus -s "system/\"$ORACLE_PWD\"@//localhost:1521/FREEPDB1"'],{input:'WHENEVER SQLERROR EXIT FAILURE\nSET HEADING OFF FEEDBACK OFF PAGESIZE 0\n'+sql+'\nEXIT\n'});
const mongoSql=(name,js)=>docker(['exec',name,'sh','-c','exec mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "$1"','panel-test',js]);
return async function probe(plugin,item,password,mode='read'){
 const name=item.containerName,write=mode==='write',change=mode==='change',value=change?'after-backup':'panel-persisted';
 if(plugin.id==='mysql'){if(write)mysqlSql(name,"CREATE TABLE panel_probe (id INT PRIMARY KEY, value VARCHAR(80)); INSERT INTO panel_probe VALUES (1,'panel-persisted');");if(change)mysqlSql(name,"UPDATE panel_probe SET value='after-backup' WHERE id=1;");assert.equal(mysqlSql(name,'SELECT value FROM panel_probe WHERE id=1;'),value);}
 else if(plugin.id==='postgresql'){if(write)pgSql(name,"CREATE TABLE panel_probe (id INT PRIMARY KEY, value VARCHAR(80)); INSERT INTO panel_probe VALUES (1,'panel-persisted');");if(change)pgSql(name,"UPDATE panel_probe SET value='after-backup' WHERE id=1;");assert.equal(pgSql(name,'SELECT value FROM panel_probe WHERE id=1;'),value);}
 else if(plugin.id==='sqlserver'){if(write)msSql(name,"CREATE TABLE master.dbo.panel_probe (id INT PRIMARY KEY, value VARCHAR(80)); INSERT INTO master.dbo.panel_probe VALUES (1,'panel-persisted');");if(change)msSql(name,"UPDATE master.dbo.panel_probe SET value='after-backup' WHERE id=1;");assert.match(msSql(name,'SET NOCOUNT ON; SELECT value FROM master.dbo.panel_probe WHERE id=1;'),new RegExp('^'+value+'$'));}
 else if(plugin.id==='oracle'){
   if(write){
     // 运行容器实际健康命令：正确凭据成功，错误凭据和 SQL 执行错误必须失败。
     const health=JSON.parse(docker(['inspect',name]))[0].Config.Healthcheck.Test;
     assert.deepEqual(health.slice(0,3),['CMD','/bin/bash','-lc']);
     docker(['exec',name,...health.slice(1)]);
     assert.throws(()=>docker(['exec','-e','ORACLE_PWD=Invalid-Health-Password-48',name,...health.slice(1)]));
     assert(health[3].includes('SELECT 1 FROM dual;'));
     assert.throws(()=>docker(['exec',name,...health.slice(1,3),health[3].replace('SELECT 1 FROM dual;','SELECT missing_panel_column FROM dual;')]));
     oracleSql(name,"CREATE TABLE panel_probe (id NUMBER PRIMARY KEY, value VARCHAR2(80));\nINSERT INTO panel_probe VALUES (1,'panel-persisted');\nCOMMIT;");
   }
   if(change)oracleSql(name,"UPDATE panel_probe SET value='after-backup' WHERE id=1;\nCOMMIT;");
   assert.equal(oracleSql(name,'SELECT value FROM panel_probe WHERE id=1;'),value);
 }
 else if(plugin.id==='mongodb'){if(write||change)mongoSql(name,`db.getSiblingDB('microi').panel_probe.updateOne({_id:1},{$set:{value:'${value}'}},{upsert:true});`);assert.equal(mongoSql(name,"print(db.getSiblingDB('microi').panel_probe.findOne({_id:1}).value)"),value);}
 else if(plugin.id==='redis'){if(write||change)assert.equal(docker(['exec',name,'redis-cli','SET','panel-probe',value]),'OK');assert.equal(docker(['exec',name,'redis-cli','GET','panel-probe']),value);assert.match(docker(['exec','-e','REDISCLI_AUTH=',name,'redis-cli','GET','panel-probe']),/NOAUTH/);}
 else if(plugin.id==='minio'){if(write)await s3('PUT','/panel-test','',password);if(write||change)await s3('PUT','/panel-test/probe.txt',value,password);assert.equal(await s3('GET','/panel-test/probe.txt','',password),value);assert.equal((await fetch(`http://127.0.0.1:${servicePort}/panel-test/probe.txt`)).status,403);}
 else if(plugin.id==='translate'){
   const languages=await (await fetch(`http://127.0.0.1:${servicePort}/languages`)).json();
   const chinese=languages.find(x=>['zh-Hans','zh'].includes(x.code)&&x.targets.includes('en'));
   assert(chinese&&languages.some(x=>x.code==='en'&&x.targets.includes(chinese.code)),'中英双向语言模型未就绪');
   const config=JSON.parse(docker(['inspect',name]))[0].Config;
   assert(config.Env.includes('LT_THREADS=1'),'翻译镜像入口必须实际使用一个工作进程');
   if(write){
     // 执行实际容器健康命令，仅替换其 HTTP 响应：单语或缺少反向模型不能误报健康。
     const command=config.Healthcheck.Test;assert.deepEqual(command.slice(0,3),['CMD','/app/venv/bin/python','-c']);
     for(const [data,healthy] of [[languages,true],[[{code:'en',targets:['en']}],false],[[{code:chinese.code,targets:['en']},{code:'en',targets:['en']}],false],[[{code:'zh',targets:['en']},{code:'en',targets:['zh']}],true]]){
       const fixture=`import io,urllib.request; urllib.request.urlopen=lambda *args,**kwargs:io.BytesIO(${JSON.stringify(JSON.stringify(data))}.encode()); `;
       let passed=true;try{docker(['exec',name,command[1],command[2],fixture+command[3]]);}catch{passed=false;}
       assert.equal(passed,healthy,'实际健康检查对语言模型缺失的判定错误');
     }
   }
   const response=await fetch(`http://127.0.0.1:${servicePort}/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:'你好',source:chinese.code,target:'en',format:'text'}),signal:AbortSignal.timeout(120000)});
   const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.match(body.translatedText,/hello|hi|how are you/i);
   const reverse=await fetch(`http://127.0.0.1:${servicePort}/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:'Hello',source:'en',target:chinese.code,format:'text'}),signal:AbortSignal.timeout(120000)});
   const reverseBody=await reverse.json();assert.equal(reverse.status,200,JSON.stringify(reverseBody));assert.match(reverseBody.translatedText,/[\u4e00-\u9fff]/);
   assert(docker(['exec',name,'sh','-c','find /home/libretranslate/.local/share/argos-translate -type f | head -n 1']).length>0,'translation model volume is empty');
 }
 else if(plugin.id==='ocr'){
   const png=docker(['exec',name,'python','-c',"from PIL import Image,ImageDraw,ImageFont; import io,base64; image=Image.new('RGB',(1100,200),'white'); ImageDraw.Draw(image).text((30,40),'MICROI PANEL 2026',fill='black',font=ImageFont.load_default(size=72)); output=io.BytesIO(); image.save(output,format='PNG'); print(base64.b64encode(output.getvalue()).decode())"]);
   const response=await fetch(`http://127.0.0.1:${servicePort}/ocr`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:png,fileType:1,useDocOrientationClassify:false,useDocUnwarping:false,useTextlineOrientation:false,visualize:false}),signal:AbortSignal.timeout(180000)});
   const body=await response.json();assert.equal(response.status,200,JSON.stringify(body).slice(0,700));assert.match(JSON.stringify(body),/PANEL\s*2026/i);
 }
 else if(plugin.id==='nginx'){const response=await fetch(`http://127.0.0.1:${servicePort}/`,{signal:AbortSignal.timeout(10000)});assert.equal(response.status,404);}
 else throw Error('No real business probe for '+plugin.id);
}
}
