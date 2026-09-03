import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(root, 'app.microi.saas-engine.json');
const packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const menuId = 'b08cce71-3a9e-4c4c-a2af-b0936b47b9a8';
const tableId = '0234e89e-2e80-4ae0-b86a-f53635e29460';
const parentId = 'cdc0844b-7249-4d64-a9c3-563a15c9cd20';
const updatedAt = '2026-09-03 15:30:00';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fieldReference(field) {
  return {
    Id: field.Id,
    AsName: '',
    Name: field.Name,
    Label: field.Label,
    TableId: tableId,
    TableName: 'diy_schedule_job',
    TableDescription: '任务调度'
  };
}

const table = (packageModel.DiyTables || []).find(item => item.Id === tableId);
assert(table, 'SaaS 官方包缺少 diy_schedule_job 表。');

const fieldsByName = new Map(
  (packageModel.DiyFields || [])
    .filter(item => item.TableId === tableId)
    .map(item => [item.Name, item])
);
const requireField = name => {
  const field = fieldsByName.get(name);
  assert(field, `SaaS 官方包缺少 diy_schedule_job.${name} 字段。`);
  return field;
};

const listNames = [
  'JobName', 'JobDesc', 'JobType', 'JobParam', 'Status', 'LastTime', 'NextTime',
  'ApiEngineKey', 'CronExpression', 'CronDesc'
];
const searchNames = ['JobName', 'JobDesc', 'Status', 'ApiEngineKey', 'CronExpression', 'CronDesc'];
const sortNames = ['CreateTime', 'NextTime', 'Status'];
const hiddenNames = ['Id', 'CreateTime', 'UpdateTime', 'UserId', 'UserName', 'IsDeleted'];
const mobileNames = ['JobName', 'JobDesc', 'Status', 'NextTime', 'ApiEngineKey'];
for (const name of new Set([...listNames, ...searchNames, ...sortNames, ...hiddenNames, ...mobileNames])) {
  requireField(name);
}

const pauseCode = `V8.ConfirmTips('确认要暂停吗？', function(){
  var para = { JobName: V8.Form.JobName, Id: V8.Form.Id };
  V8.Post('/api/Job/PauseJob', para, function(result){
    if(result.Code == 1){
      V8.Tips('暂停成功', true);
      V8.RefreshTable({ _PageIndex: 1 });
    } else {
      V8.Tips(result.Msg || '暂停失败', false);
    }
  }, { DataType: 'form' });
});`;

const resumeCode = `V8.ConfirmTips('确认要恢复吗？', function(){
  if(V8.Form.Status != '暂停'){
    V8.Tips('只有暂停状态可以恢复', false);
    V8.Result = false;
    return;
  }
  var para = { JobName: V8.Form.JobName, Id: V8.Form.Id };
  V8.Post('/api/Job/ResumeJob', para, function(result){
    if(result.Code == 1){
      V8.Tips('恢复成功', true);
      V8.RefreshTable({ _PageIndex: 1 });
    } else {
      V8.Tips(result.Msg || '恢复失败', false);
    }
  }, { DataType: 'form' });
});`;

const viewSchema = {
  Views: [
    {
      Key: `${menuId}-list`,
      Scene: 'List',
      Device: 'PC',
      Enabled: true,
      Priority: 20,
      Layout: {
        Hero: {
          Eyebrow: 'SYSTEM ENGINE',
          Title: '任务调度',
          Description: '管理周期任务与下次执行计划',
          Metrics: [
            {
              Key: 'DataCount',
              Label: '总记录数',
              Source: 'DataCount',
              Icon: 'fas fa-layer-group',
              Tone: 'primary',
              Color: 'var(--mci-text-primary, #334155)'
            },
            { Key: 'PageCount', Label: '本页加载', Source: 'PageCount', Icon: 'fas fa-list', Tone: 'info' },
            {
              Key: 'Metric_2_Status',
              Label: '启用',
              Source: 'ApiEngine',
              ApiEngineKey: 'mci-module-presentation-stats',
              ValuePath: '',
              Icon: 'fas fa-circle-check',
              Tone: 'success',
              DefaultValue: 0
            }
          ]
        },
        List: {
          Density: 'Compact',
          Columns: [
            {
              Key: 'primary',
              Field: 'JobName',
              Lines: [{
                Name: 'JobDesc',
                Label: '任务名称',
                Tone: 'neutral',
                Color: 'var(--mci-text-secondary, #475569)',
                ShowLabel: false
              }],
              TrailingFields: [
                { Name: 'JobType', Label: '任务类别', Icon: 'fas fa-circle', Tone: 'primary', DisplayStyle: 'Tag' }
              ],
              RequiredFields: ['JobDesc', 'JobType'],
              MinWidth: 260,
              Align: 'Left'
            }
          ]
        }
      }
    },
    {
      Key: `${menuId}-card`,
      Scene: 'Card',
      Device: 'Mobile',
      Enabled: true,
      Priority: 20,
      Layout: {
        Card: {
          Preset: 'Business',
          AvatarTextField: 'JobName',
          TitleField: 'JobName',
          AccentField: 'Status',
          StatusFields: [{ Name: 'Status', Label: '任务状态', DisplayStyle: 'Tag', Tone: 'success' }],
          SubtitleFields: [{
            Name: 'JobDesc',
            Label: '任务名称',
            Tone: 'neutral',
            Color: 'var(--mci-text-secondary, #475569)'
          }],
          Fields: [{ Name: 'ApiEngineKey', Label: '接口引擎', ShowLabel: true }],
          MetaFields: [{ Name: 'NextTime', Label: '下次执行时间', ShowLabel: true }],
          TopFields: [],
          RightFields: [],
          BottomFields: [],
          HideIndex: true,
          ShowCreateTime: false,
          ShowUpdateTime: false
        }
      }
    }
  ]
};

packageModel.SysMenus ||= [];
const existingIndex = packageModel.SysMenus.findIndex(item => item.Id === menuId);
const template = existingIndex >= 0
  ? packageModel.SysMenus[existingIndex]
  : packageModel.SysMenus.find(item => item.Url === '/osclients');
assert(template, 'SaaS 官方包缺少可复用的标准 Diy 菜单模板。');

const menu = JSON.parse(JSON.stringify(template));
Object.assign(menu, {
  Id: menuId,
  Name: '任务调度',
  Description: '管理周期任务、运行状态与下次执行计划。',
  Code: '',
  Url: '/job-engine',
  ParentId: parentId,
  Sort: 200,
  Icon: '/itdos/microi/webos-icons/ios-skeuomorphic-v2/202609/schedule.webp',
  IconClass: 'Timer',
  CreateTime: '2023-10-10 13:54:36',
  UpdateTime: updatedAt,
  OpenType: 'Diy',
  ComponentName: '{}',
  ComponentPath: '/diy/diy-table-rowlist',
  MultRun: 1,
  Display: 1,
  AppDisplay: 1,
  DisplayMac: 1,
  DisplayWin: 1,
  HasChild: 0,
  DiyTableId: tableId,
  DiyTableName: 'diy_schedule_job',
  ModuleEngineKey: 'diy_schedule_job',
  TableDiyFieldIds: JSON.stringify(listNames.map(name => requireField(name).Id)),
  SelectFields: JSON.stringify(listNames.map(name => fieldReference(requireField(name)))),
  SearchFieldIds: JSON.stringify(searchNames.map(name => fieldReference(requireField(name)))),
  SortFieldIds: JSON.stringify(sortNames.map(name => requireField(name).Id)),
  NotShowFields: JSON.stringify(hiddenNames.map(name => requireField(name).Id)),
  StatisticsFields: '[]',
  DefaultOrderBy: JSON.stringify([
    { Id: requireField('CreateTime').Id, Name: 'CreateTime', Sort: 0, Type: 'DESC' }
  ]),
  MobileListFields: JSON.stringify(mobileNames.map(name => fieldReference(requireField(name)))),
  CardTitleTagFields: JSON.stringify([fieldReference(requireField('Status'))]),
  CardBottomTagFields: JSON.stringify([fieldReference(requireField('NextTime'))]),
  MoreBtns: JSON.stringify([
    {
      Id: '6347bbe8-d615-4ad8-9f0c-a6f8ac3d0e7d',
      Sort: 0,
      Name: '暂停',
      V8Code: pauseCode,
      V8CodeShow: '',
      Icon: 'fas fa-circle-pause',
      Url: '',
      BtnStyle: 'warning',
      ShowRow: true,
      IsVisible: true
    },
    {
      Id: '827116ab-fc96-435a-b59d-cabb60f01e5c',
      Sort: 1,
      Name: '恢复',
      V8Code: resumeCode,
      V8CodeShow: '',
      Icon: 'fas fa-circle-play',
      Url: '',
      BtnStyle: 'success',
      ShowRow: true,
      IsVisible: true
    }
  ]),
  PageBtns: '[]',
  PageTabs: '[]',
  FormBtns: '[]',
  BatchSelectMoreBtns: '[]',
  ExportMoreBtns: '[]',
  FixedFields: '[]',
  JoinTables: '[]',
  TableHeaders: '[]',
  InTableEdit: 0,
  InTableEditFields: '[]',
  DiyConfig: JSON.stringify({ SelectApi: '', AddBtnText: '', HiddenIndex: 0, GeneralSeaarch: 0 }),
  GeneralSeaarch: 0,
  HiddenIndex: 1,
  EnableDrafts: 0,
  EnableViewSchema: 1,
  ViewSchemaVersion: '1.0',
  ViewConfigVersion: 5,
  ViewSchema: JSON.stringify(viewSchema),
  MenuBadgeEnabled: 0,
  MenuBadgeApiEngineKey: null,
  MenuBadgeTooltip: null
});

if (existingIndex >= 0) packageModel.SysMenus[existingIndex] = menu;
else packageModel.SysMenus.push(menu);
packageModel.PackageInfo ||= {};
packageModel.PackageInfo.MenuCount = packageModel.SysMenus.length;

fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ menuId, tableId, menuCount: packageModel.SysMenus.length }, null, 2)}\n`);
