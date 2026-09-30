import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync(process.env.MICROI_CALENDAR_TEST_SOURCE||new URL('../src/views/fullcalendar/fullcalendar.vue',import.meta.url),'utf8');
const script=source.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/^import .*;\r?$/gm,'').replace('export default','globalThis.calendarComponent =');
const sandbox={FullCalendar:{},dayGridPlugin:{},timeGridPlugin:{},interactionPlugin:{},zhLocale:{},console,Date};
vm.runInNewContext(script,sandbox);
const component=sandbox.calendarComponent;
function instance(overrides={}) {
  const target={readOnly:false,compact:true,embedded:true,menuId:'authorized-calendar-menu',...component.methods,...overrides};
  Object.assign(target,component.data.call(target));return target;
}
test('compact date click opens creation with real dates while readonly mode blocks interaction',()=>{
  const target=instance();let unselected=0;
  assert.equal(typeof target.calendarOptions.dateClick,'function');
  target.handleDateClick({date:new Date(2026,8,30,9),view:{calendar:{unselect(){unselected++;}}}});
  assert.equal(target.dialogVisible,true);assert.equal(target.form.StartTime,'2026-09-30 09:00:00');
  assert.equal(target.form.EndTime,'2026-09-30 10:00:00');assert.equal(unselected,1);
  assert.equal(target.calendarOptions.navLinks,false);
  const readonly=instance({readOnly:true});assert.equal(readonly.calendarOptions.dateClick,undefined);
  readonly.handleDateClick({date:new Date()});assert.equal(readonly.dialogVisible,false);
});
test('calendar writes the registered Remark field and resets pending state on server rejection',async()=>{
  let saved;const target=instance();target.dialogVisible=true;target.form.Remark='会议提醒说明';
  target.$refs={formRef:{validate:async()=>{}}};
  target.DiyCommon={FormEngine:{AddFormData:async p=>{saved=p;return {Code:0,Msg:'无新增权限'};}},Tips(){}};
  await target.handleSubmit();assert.equal(saved.Remark,'会议提醒说明');assert.equal(Object.hasOwn(saved,'Beizhu'),false);
  assert.equal(target.dialogVisible,true);assert.equal(target.submitting,false);
});
test('failed form validation never submits an event',async()=>{
  let calls=0;const target=instance();target.$refs={formRef:{validate:async()=>{throw Error('invalid')}}};
  target.DiyCommon={FormEngine:{AddFormData:async()=>{calls++;}}};await target.handleSubmit();assert.equal(calls,0);
});
test('event reload preserves registered remarks and reads the legacy event remark key',async()=>{
  const target=instance();target.DiyCommon={FormEngine:{GetTableData:async()=>({Code:1,Data:[{Id:'current',Title:'会议',Remark:'当前备注'},{Id:'legacy',Title:'历史日程',Beizhu:'旧备注'}]})}};
  let events;await target.fetchEvents({start:new Date(2026,8,1),end:new Date(2026,9,1)},rows=>{events=rows;});
  assert.equal(events[0].extendedProps.Remark,'当前备注');assert.equal(events[1].extendedProps.Remark,'旧备注');
});
