import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('./import-package.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('    var prepareNumericColumnData ='),source.indexOf('    // MARKETPLACE_CHANGELOG_TENANT_COLLISION_REPAIR_V1'));
function run({isSwitch=true,targetType='varchar(255)',invalid=0,binary=261}={}){
 const sql=[],scope={isNumericSqlType:type=>/^(int|bit)/.test(type),isIntegerSqlType:()=>true,isPackageSwitchColumn:()=>isSwitch,
  getScalarCount:(row,names)=>names.map(n=>row[n]).find(v=>v!==undefined)||0,getPhysicalValue:(row,names)=>names.map(n=>row[n]).find(v=>v!==undefined),
  V8:{Db:{FromSql:text=>{sql.push(text);return {AddInParameter(){return this;},ToArray(){
   if(text.includes('AS InvalidCount'))return [{InvalidCount:invalid}];
   if(text.includes('AS InvalidHex'))return [{InvalidHex:'02'}];
   if(text.includes('AS LegacySwitchBinaryCount'))return [{LegacySwitchBinaryCount:binary}];
   if(text.includes('AS LegacyBooleanCount'))return [{LegacyBooleanCount:0}];
   return [{BlankCount:0}];
  },ExecuteNonQuery(){return binary;}};}}}};
 vm.runInNewContext(fn,scope);
 try{return {result:scope.prepareNumericColumnData('diy_lang','IsDeleted',{IS_NULLABLE:'YES'},'int',targetType),sql};}
 catch(error){return {error,sql};}
}
test('only declared Switch single-byte 00/01 is excluded from dirty text and normalized',()=>{
 const {result,sql,error}=run();assert.equal(error,undefined);assert.equal(result.LegacySwitchBinaryCount,261);
 assert.match(sql[0],/AND NOT \(OCTET_LENGTH\(`IsDeleted`\) = 1 AND HEX\(`IsDeleted`\) IN \('00','01'\)\)/);
 const updates=sql.filter(x=>x.startsWith('UPDATE'));assert.equal(updates.length,1);
 assert.match(updates[0],/CASE HEX\(`IsDeleted`\) WHEN '01' THEN 1 ELSE 0 END WHERE OCTET_LENGTH\(`IsDeleted`\) = 1 AND HEX\(`IsDeleted`\) IN \('00','01'\)$/);
});
test('ordinary columns and all other invalid values stay fail closed without updates',()=>{
 for(const isSwitch of [false,true]){
  const {error,sql}=run({isSwitch,invalid:1});assert.match(error.message,/非数字数据/);assert.equal(sql.some(x=>x.startsWith('UPDATE')),false);
  if(!isSwitch)assert.doesNotMatch(sql[0],/OCTET_LENGTH|HEX/);
 }
});
test('real numeric BIT and integer columns do not enter legacy text recovery or scan rows',()=>{
 for(const targetType of ['bit(1)','int']){const {result,sql,error}=run({targetType});assert.equal(error,undefined);assert.equal(result.LegacySwitchBinaryCount,0);assert.deepEqual(sql,[]);}
});
