import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const source=(await readFile(new URL('./import-package.js',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
function fixture(){
 const context={};
 for(const name of ['normalizeSqlType','normalizeLegacyMenuEmptyValues']){
  const match=source.match(new RegExp('    var '+name+' = function \\([^]*?\\n    \\};'));
  assert(match, name);vm.runInNewContext(match[0],context);
 }
 return context;
}
test('legacy nullable numeric menu references receive NULL and preserve text, IDs and nonempty values',()=>{
 const f=fixture();
 const model={Id:'',ReportId:'',Sort:'  ',Order:'',Name:'',Existing:'12',NonNullable:''};
 const cols={reportid:{COLUMN_TYPE:'int(11)',IS_NULLABLE:'YES'},sort:{COLUMN_TYPE:'decimal(18,2)',IS_NULLABLE:'YES'},
  order:{COLUMN_TYPE:'bigint unsigned',IS_NULLABLE:'YES'},name:{COLUMN_TYPE:'varchar(50)',IS_NULLABLE:'YES'},
  existing:{COLUMN_TYPE:'int',IS_NULLABLE:'YES'},nonnullable:{COLUMN_TYPE:'int',IS_NULLABLE:'NO'}};
 f.normalizeLegacyMenuEmptyValues(model,cols);
 assert.deepEqual(model,{Id:'',ReportId:null,Sort:null,Order:null,Name:'',Existing:'12',NonNullable:''});
 f.normalizeLegacyMenuEmptyValues(model,cols);
 assert.equal(model.ReportId,null);
});
test('modern text references and invalid nonempty numeric values are not silently converted',()=>{
 const f=fixture();const modern={ReportId:''},invalid={ReportId:'report-guid'};
 f.normalizeLegacyMenuEmptyValues(modern,{reportid:{COLUMN_TYPE:'varchar(36)',IS_NULLABLE:'YES'}});
 f.normalizeLegacyMenuEmptyValues(invalid,{reportid:{COLUMN_TYPE:'int',IS_NULLABLE:'YES'}});
 assert.equal(modern.ReportId,'');assert.equal(invalid.ReportId,'report-guid');
 assert(source.indexOf('normalizeLegacyMenuEmptyValues(modelCopy, legacyMenuPhysicalColumns);')<source.indexOf("'menu_upt_' + menu.Id"));
});
