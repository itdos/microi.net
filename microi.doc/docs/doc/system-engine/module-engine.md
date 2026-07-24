# 📦 模块引擎

> **包含模块配置、数据源配置、接口替换、动态按钮等配置**

![module-engine](https://static.itdos.com/upload/img/csdn/a1501c7cf43c402eb961952ec2619f43.png#pic_center)
## 模块配置

## 跨端统一视图

跨端视图属于模块引擎，因为同一张表可能被多个 `sys_menu` 以不同角色、业务场景和卡片样式复用。配置保存在 `sys_menu` 的专用物理字段中，不放在 SaaS 引擎、`diy_table` 或 `DiyConfig`：

| 物理字段 | 说明 |
| --- | --- |
| `EnableViewSchema` | `1` 启用跨端视图；未启用时继续使用现有表单和模块配置。 |
| `ViewSchemaVersion` | 协议语义版本，例如 `1.0`。 |
| `ViewConfigVersion` | 配置递增版本；每次发布视图时递增，用于客户端缓存失效。 |
| `ViewSchema` | Detail、Edit、List、Card 的版本化 JSON。 |

`diy_table.DiyConfig`、`diy_field.DiyConfig`、`sys_menu.DiyConfig` 均已废弃。旧字段只保留历史读取兼容，新功能必须增加专用物理列，并通过 `diy_field` 元数据提供设计控件。

### 视图结构

```json
{
  "Views": [
    {
      "Key": "customer-detail",
      "Scene": "Detail",
      "Device": "All",
      "RoleIds": [],
      "Priority": 10,
      "Layout": {
        "Hero": {
          "TitleField": "KehuMC",
          "ImageField": "Logo",
          "StatusField": "KehuHZ",
          "MetaField": "KehuLX",
          "Metrics": [
            { "Label": "设备", "Field": "ShebeiSL", "Suffix": "台" }
          ]
        },
        "Actions": [
          {
            "Key": "orders",
            "Label": "合同订单",
            "ActionType": "OpenList",
            "ModuleEngineKey": "orders",
            "ParamMap": { "KehuID": "$form.Id" }
          }
        ],
        "Blocks": [
          {
            "Key": "basic",
            "Type": "ResponsiveSection",
            "Title": "客户信息",
            "Columns": 3,
            "DefaultExpanded": true,
            "Fields": ["KehuMC", "KehuLX", "LianxiDH"]
          }
        ]
      }
    }
  ]
}
```

- `Scene`：`Detail`、`Edit`、`List`、`Card`。
- `Device`：`PC`、`Mobile`、`All`。
- `RoleIds`：空数组表示所有已获模块权限的角色；配置角色后优先选择角色专属视图。
- `Priority`：同场景、同终端命中多个视图时选择优先级更高者。
- 没有新视图、配置损坏或客户端暂不支持某个区块时，必须回退到现有 `sys_menu + diy_table + diy_field` 渲染，不能白屏。

### 标准视图区块

数据控件继续由 `diy-field-component` 负责，例如 Text、Select、ImgUpload、Map、RichText。以下区块不代表数据库字段，独立存放在 `form-view-blocks`：

| 区块 | 用途 |
| --- | --- |
| `EntityHero` | 背景、图片、标题、副标题、状态徽标与关键指标。 |
| `MetricStrip` | 字段值、关联数量、聚合结果或接口引擎指标。 |
| `ActionGrid` | 图标化快捷入口和业务动作。 |
| `ResponsiveSection` | PC 1 至 4 列、移动端单列的详情分组与折叠。 |

详情模式使用只读详情渲染器，不把所有字段伪装成禁用输入框；编辑模式继续复用完整表单控件、校验、数据源和后端表单事件。未被视图区块显式引用的 PC 字段必须进入兜底分组，保证字段完整度不低于原表单。

### 跨端动作

小程序不会下载或执行 `V8Code`。跨端按钮使用声明式动作：

- `ActionType`：`ApiEngine`、`OpenDetail`、`OpenList`、`OpenForm`、`Navigate`、`Dial`、`Scan`、`Map`、`Refresh`、`Back`、`Copy`。
- `ParamMap`：支持 `$form.Field`、`$user.Field`、`$menu.Field` 白名单绑定。
- `VisibleWhen`：字段、操作符和值组成的声明式显隐条件，不使用 `eval`。
- `Confirm`、`SuccessMessage`、`SuccessActions`：确认、成功提示和后续刷新/跳转。
- 涉及校验、事务、跨表写入和数据权限的逻辑必须放到接口引擎或 `SubmitBeforeServerV8` / `SubmitAfterServerV8`。

PC 可继续兼容历史按钮 V8，但跨端视图只向小程序输出规范化后的安全动作。客户端调用时携带当前授权模块的真实 `_SysMenuId`；接口引擎仍在服务端可信执行链中运行。

## 打开方式
### **Diy**
>* 以表单引擎渲染，打开是一个表格

### **Component**
>* 以定制vue组件打开，需要填写定制组件路径

### **Iframe**
>* 以iframe模式打开
```
//如要打开百度，则需要设置url地址为：/iframe/https://baidu.com
//可以在地址中跟上系统当前登录用户的token值，如：/iframe/https://baidu.com?token=$V8.CurrentToken$
```
#### 地址接口引擎
>* 当打开方式选择为**Iframe**时，可选择动态返回地址的接口引擎，以实现第三方系统的单点登录
::: details 展开查看 JavaScript 代码（22 行）
```js
//先取缓存
var cacheTokenKey = `Microi:${V8.OsClient}:IotToken-meslogin-jwlrd`;
var cacheToken = V8.Cache.Get(cacheTokenKey);
if(cacheToken){
  return { Code : 1, Data : 'https://第三方系统apibase/mg-ui/#/auto-login?token=' + cacheToken }
}
var result = V8.Http.Post({
  Url : 'https://第三方系统apibase/api/third/findAccessToken',
  PostParam : {
    userName : '账号',
    password : '密码',
  },
  // ParamType : 'json',
})
var resultObj = JSON.parse(result);
if(resultObj.code == 0 && resultObj.data && resultObj.data.token)//表示成功
{
  //缓存token
  V8.Cache.Set(cacheTokenKey, resultObj.data.token, '3.00:00:00');//缓存3天
  return { Code : 1, Data : 'https://第三方系统apibase/mg-ui/#/auto-login?token=' + resultObj.data.token};
}
return { Code : 0, Data : resultObj, Msg : result };
```
:::

### **SecondMenu**
>* 含子菜单的上级菜单

### **Report**
>* 虚拟报表

## 树形+表格（左右结构）

适用于“左侧按项目、分类或组织导航，右侧显示关联数据列表/表单”的业务页面。目标菜单使用组件模式：

```json
{
  "ComponentName": "树形+表格",
  "ComponentPath": "/diy/left-right/LeftTreeJoinRightForm"
}
```

页面配置保存在 `diy_LeftJoinRightView`。同一菜单应只有一条有效配置，保存前按【关联菜单】回读并复用，避免重复配置造成命中不确定。

### 核心配置

| 配置项 | 说明 |
| --- | --- |
| `GuanlianCD`（关联菜单） | 当前右侧业务菜单链，末级为当前菜单 `sys_menu.Id`。 |
| `ShuxingGLCD`（树形关联菜单） | 左侧主数据菜单链。 |
| `GuanlianBD`（关联表单） | 左侧主表，例如 `xiangmuguanli`。 |
| `FubiaoGLZD`（父表关联字段） | 左表关联键，通常为 `Id`。 |
| `ZibiaoGLZD`（子表关联字段） | 右表外键，例如 `XiangmuID`、`ProjectId`；必须以实时表结构为准。 |
| `GuanlianPPLJ`（关联匹配逻辑） | 普通主外键使用 `=`。 |
| `ZuobianZSZJ` / `YoubianZSZJ` | 左侧通常为 `树形控件`；右侧可选 `表格`、`表单`、`表单/表格`。 |
| `ShuxianSZDM`（树显示字段名） | 必须和初始化 V8 返回对象的属性名一致。 |
| `ChushiHDM`（初始化代码） | 读取 `V8.Form._PageIndex/_PageSize/inputText` 获取左树当前页，最终返回 `Data` 和 `DataCount`。 |
| `ZuoyouXSZB`（左右显示占比） | 24 栅格比例，例如 `6/18`，`/` 是必要分隔符。 |
| `ShubiaoT` | 左侧标题。 |
| `ShumoHSS`、`ShuxiaLSS`、`ShusouSAN`、`ShushuaX` | 模糊搜索、搜索字段下拉、搜索按钮、刷新按钮。 |
| `ShudingJXZ`、`ShuxinZ`、`ShubianJ`、`ShushanC` | 顶级新增、节点新增、编辑、删除；仅在业务允许时开启。 |
| `ShujieDDJSJ`、`JiedianANXSSJ` | 节点点击事件、节点按钮显示事件 V8。 |
| `YincangBSF` | 节点值命中时隐藏右侧区域。 |
| `TanchuangLX`、`TanchuangDX` | 树节点维护弹窗类型与大小。 |
| `LanjiaZ`、`LanjiaZDM` | 大数据树懒加载开关与代码。 |

左树也必须分页。组件默认每页 20 条，允许切换 10/20/50/100 条；搜索会回到第一页。初始化代码示例：

```js
var form = V8.Form || {};
var pageIndex = Math.max(1, parseInt(form._PageIndex || 1, 10));
var pageSize = Math.min(100, Math.max(1, parseInt(form._PageSize || 20, 10)));
var keyword = String(form.inputText || '').trim();
var query = {
    _SelectFields: ['Id', 'Code', 'Name'],
    _OrderBy: 'CreateTime',
    _OrderByType: 'DESC',
    _PageIndex: pageIndex,
    _PageSize: pageSize
};

if (keyword) {
    query._Where = [
        ['Code', 'Like', keyword],
        ['OR', 'Name', 'Like', keyword]
    ];
}

var result = await V8.FormEngine.GetTableData('xiangmuguanli', query);

if (result.Code !== 1) {
    V8.Result = result;
    return;
}

V8.Result = {
    Code: 1,
    Data: (result.Data || []).map(function (item) {
        return {
            Id: item.Id,
            TreeTitle: [item.Code, item.Name].filter(Boolean).join(' '),
            Code: item.Code,
            Name: item.Name
        };
    }),
    DataCount: Number(result.DataCount || 0),
    PageIndex: pageIndex,
    PageSize: pageSize
};
```

此时配置 `ShuxianSZDM=TreeTitle`、`FubiaoGLZD=Id`。右侧表格根据 `ZibiaoGLZD = 当前节点.Id` 查询；点击【全部】时清除关联条件。

加载期间组件显示“正在加载项目...”，不会先显示“暂无数据”；并发搜索/翻页只接受最后一次请求结果，避免旧页覆盖新页。禁止用大 `_PageSize` 一次拉取完整项目表。

### 移动端与验收

- 手机端不把左树堆在数据列表顶部。右侧列表占满页面，顶部“项目目录”按钮从左侧打开宽度 `88%`、高度 100% 的树形抽屉。
- 抽屉带遮罩、关闭按钮并支持点击遮罩或 Esc 关闭；选择节点后自动关闭，同时保留筛选结果。
- 左树在抽屉内独立滚动，搜索、分页、每页条数切换均可操作。
- 禁止用固定高度或祖先 `overflow:hidden` 截断卡片、分页、底部按钮。
- 至少验证桌面 1440x900 与手机 390x844：20 条分页、切换每页条数、搜索、节点筛选、全部、刷新、抽屉打开/关闭、右侧新增自动写入外键，以及树和列表都能滚动到底。

## 数据源配置
>* **关联表**：join哪些表，设置表的别名

>* **查询列**：select哪些字段

>* **不显示列**：有些id字段select后不需要显示在表格上

>* **可排序列**：哪些字段可以排序

>* **默认排序列**：默认多字段排序

>* **可搜索列**：哪些字段可以被搜索

>* **统计列**：哪些字段需要统计

>* **开启表内编辑**：开启表内编辑后，还需设置可编辑列

>* **Join关联**：自由编写关联表的条件

>* **Where条件**：自由编写where条件，实现权限控制
示例[每个人只能查看自己的数据，或者上级可以查看同部门下级的数据]：

(A.UserId = '$CurrentUser.Id$' OR (B.Level > $CurrentUser.Level$ AND B.DeptCode LIKE '$CurrentUser.DeptCode$%'))

注意：默认选择的DIY表已经占用了表别名A。

可使用的变量名：$CurrentUser.Id$、$CurrentUser.Level$、$CurrentUser.DeptId$、$CurrentUser.DeptCode$、$yyyy$、$yyyy-MM$（日期格式依次类推）

>* **导入模板**：提前做好导入模板让用户下载

>* **表格分页序号递增**：非第一页序号继承页码

## 接口替换
>* **查询接口替换**
>* 所有的接口替换地址均支持$ApiBase$、$CsClient$变量，自动从系统设置中获取

>* **[新增]模式**
>支持**弹窗**和**表内**

>* **导入接口替换**
::: details 展开查看 JavaScript 代码（53 行）
```js
//可以使用接口引擎实现导入接口，一旦替换了导入接口，那么导入进度（redis）也一定要设置
if(!V8.Param.TableId){
    return { Code : 0, Message : '必须指定一个TableId，以标记正在导入哪张表！' }
}
//判断当前表是否正在导入中，防止重复导入
var isImportingKey = `Microi:${V8.OsClient}:ImportTableDataStart:${V8.Param.TableId}`;
var importStepKey = `Microi:${V8.OsClient}:ImportTableDataStep:${V8.Param.TableId}`;
var importStepList = [];
if(V8.Cache.Get(isImportingKey) == '1'){
    return { Code : 0, Message : '注意：有数据正在导入！请导入结束后再操作。若进度异常，请联系系统管理员！' }
}
V8.Cache.Set(isImportingKey, '1');//标记正在导入

//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + '：正在读取文件数据...');
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));

//获取excel数据
var filesByteBase64 = V8.FilesByteBase64;
var base64String = Object.values(filesByteBase64)[0];
var dataList = V8.Office.ExcelToList({
  FileByteBase64 : base64String,
  SheetIndex : 0//取第一张表
});
dataList.Data.forEach(item => {
  item.AAA = 111;
});

//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + "：已读取【" + dataList.Data.length + "】条数据！");
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：已导入【0】条数据...`);
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));

dataList.Data.forEach((item, index) => {
  //循环导入数据
  var addResult = V8.FormEngine.AddFormData('tableName', item, V8.DbTrans);
  if(addResult.Code != 1){
    //返回错误结果，平台会自动回滚事务（禁止手动调用V8.DbTrans.Rollback()）
    V8.Cache.Set(isImportingKey, '0');//取消标记正在导入
    //写进度
    importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：导入出现错误：${addResult.Msg}。已回滚！`);
    V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
    return { Code : 0, Msg : addResult.Msg };//平台识别到Code!=1，自动回滚事务
  }
  //写进度（覆盖上一条）
  importStepList[importStepList.length - 1] = DateNow('yyyy-MM-dd HH:mm:ss') + `：已导入【${index+1}】条数据...`;
  V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
});
//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：导入成功，已结束！`);
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
V8.Cache.Set(isImportingKey, '0');//取消标记正在导入
return { Code : 1 };
```
:::

>* **导入进度接口替换**
```js
if(!V8.Param.TableId){
    return { Code : 0, Message : '必须指定一个TableId，以标记要获取哪张表的导入进度！' }
}
//获取进度
var importStepStr = V8.Cache.Get(`Microi:${V8.OsClient}:ImportTableDataStep:${V8.Param.TableId}`);
return { Code ：1, Data : JSON.parse(importStepStr) };
```

>* **导出接口替换**：见相关文章：
>[Microi吾码-自定义导出Excel](https://microi.blog.csdn.net/article/details/143619083)
>[micori吾码-使用接口引擎实现自定义导出excel](https://microi.blog.csdn.net/article/details/143849425)

## 动态按钮
>* **表单更多按钮**

>* **行更多按钮**

>* **更多导出按钮**

>* **批量选择更多按钮**
添加至少一个批量选择更多按钮后，数据列表会自动打开批量勾选功能
```js
//批量删除数据
var selectData = V8.SelectedData;
if(selectData.length == 0){
  V8.Tips('请选择要删除的数据！', false);
  return;
}
V8.ConfirmTips(`确认批量删除选中的[${selectData.length}]条数据？`, async function(){
  var ids = selectData.map(item => { return item.Id });
  var result = await V8.FormEngine.DelFormData('diy_order', {
    Ids : ids
  });
  if(result.Code != 1){
    V8.Tips('删除失败：' + result.Msg, false);
    return;
  }
  V8.Tips('删除成功！');
  V8.RefreshTable({ _PageIndex : 1 })
});
```

>* **页面更多按钮**

>* **页面多Tab**

页面多Tab支持两种动态模式：

- 不配置【关联模块】：在当前模块执行 `V8Code`，通常使用 `V8.SearchSet(...)` 切换筛选条件。
- 配置【关联模块】：保存目标 `sys_menu.Id` 到 `TargetSysMenuId`。点击后替换当前路由并完整加载目标模块；目标菜单可以设置 `Display=0、AppDisplay=0` 隐藏导航入口，但仍需给当前角色分配菜单权限。

关联模块适合一个业务入口下不同页签分别使用不同 `diy_table`、字段、列表模板、查询接口替换或按钮配置的场景。所有关联模块建议配置同一组 PageTabs，才能从任意页签无感切回其它模块；不要在前端 mixin 中按菜单名或表名写死数据源。

```json
[
  {
    "Id": "01K...",
    "Sort": 10,
    "Name": "本地记录",
    "TargetSysMenuId": "目标sys_menu.Id",
    "IsVisible": true
  }
]
```

## 平台支持的URL参数
>* ShowClassicTop：若设置为0，则不显示经典顶部内容。默认值为1
>* ShowClassicLeft：若设置为0，则不显示经典左侧菜单。默认值为1
>* FormDataId：数据列表默认打开哪一条数据
```js
https://os.itdos.com/#/notice?ShowClassicTop=0&ShowClassicLeft=0&FormDataId=b8348d26-b395-4313-b97d-6e41f9ff5270
```
