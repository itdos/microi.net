レポートエンジン紹介レポートエンジンは「データソースエンジンインタフェースエンジンフォームエンジンモジュールエンジン」の組み合わせで実現され、現在は一時的に表表現形式しかサポートしておらず、「earts」の図形展示形式が開発中である。

機能のハイライト1. 支持完全自定义的增、删、改、查：一般统计报表数据来源于多张表，在执行新增、修改、删除时可能需要操作多张表，可通过接口引擎事务实现。
2. 报表均会生成虚拟 `diy_table` 表、虚拟 `diy_field` 字段
3. 报表支持独立表单设计（虚拟字段）
4. 支持【模块引擎】为报表配置查询列、可编辑列、可搜索列等等

表レポートを作成します1. 创建一条数据源引擎。目前一个报表引擎均需要一个数据源引擎来提供数据源支撑。数据源支持 `SQL、V8、JSON`（若老版本数据源类型中包含中文，请修改为此三项就大写字母）
2. 创建一条报表引擎。选择相应的数据源，保存后再配置一下需要显示的字段
3. 在【模块引擎DIY】新增一个模块，选择打开方式选择【DIY】。并选择刚刚自动生成的虚拟报表
4. 在【报表引擎】设计中，修改【查询接口替换、新增接口替换、修改接口替换、删除接口替换】为接口引擎相应的实现接口（如替换为：`/apiengine/get_webuser_info` ）

実現効果の展示取引先は商店街の小さなプログラムで、小さなプログラムで買い物をするとポイントが得られ、このレポートには各マーチャントが生成したポイント消費注文数ポイント消費統計が記録されている。

頭部のマーチャント名、注文時間で検索フィルタリングを行い、所定時間内のポイント注文統計を動的に統計することができる。


![レポートエンジン]

実現手順データソースエンジンの追加データソースエンジンに新しいデータソースを追加して、レポートのデータを統計します。実装コードは次のとおりです

```js
// 分页参数
var pageIndex = V8.Param._PageIndex || 1;
var pageSize = V8.Param._PageSize || 15;
var PageNum = 0
if (pageIndex > 1) {
  PageNum = pageSize * (pageIndex - 1)
}
 
// 搜索条件
var ShanghuMC = ''
var _Where = V8.Param._Where || '';
if(_Where){
  _Where = JSON.parse(_Where)
  _Where.forEach(item=>{
    if(item.Name == 'ShanghuMC') ShanghuMC = item.Value
  })
}
// 关键词搜索
var _Keyword = ''
if(V8.Param._Keyword){
  _Keyword = V8.Param._Keyword
}
// 时间搜索条件
var KaishiSJ = ''
var JieshuSJ = ''
var where1 = ''
if(V8.Param._SearchDateTime){
  var ShijianFW = V8.Param._SearchDateTime.ShijianFW
  if(ShijianFW){
    KaishiSJ = ShijianFW[0]
    JieshuSJ = ShijianFW[1]
    KaishiSJ = `${KaishiSJ} 00:00:00`
    JieshuSJ = `${JieshuSJ} 23:59:59`
    where1 = `and CreateTime >= '${KaishiSJ}' and CreateTime <= '${JieshuSJ}'`
  }
  
}
 
// 统计总共的条数
var Count =  V8.Db.FromSql(`select count(Id) from diy_shanghuGL where IsDeleted = 0 and ShenheZT = '已通过' and ShangjiaZT = '上架' and ShanghuMC Like '%${ShanghuMC}%' and ShanghuMC Like '%${_Keyword}%'`).ToScalar()
 
// 获取主数据
var ShanghuInfo = V8.Db.FromSql(`select * from diy_shanghuGL where IsDeleted = 0 and ShenheZT = '已通过' and ShangjiaZT = '上架' and ShanghuMC Like '%${ShanghuMC}%' and ShanghuMC Like '%${_Keyword}%'  limit ${PageNum},${pageSize} `).ToArray()
var data = []
 
// 写代码逻辑获取需要的内容
ShanghuInfo.forEach(item=>{
  var FuzeR = V8.Db.FromSql(`select * from sys_user where Id = '${item.FuzeRID}'`).ToArray();
  FuzeR = FuzeR[0];
  var obj = {
    ShanghuMC:item.ShanghuMC,
    FuzeRXM : FuzeR.Name || FuzeR.Account,
    FuzeR : FuzeR.Account,
    YonghuID : FuzeR.Id,
    ShanghuSK : 0,
    DingDanShu:0,
    ShanghuID : item.Id,
    ShanghuLOGO : item.ShanghuLOGO
  }
// 消费积分统计
  obj.ShanghuSK = V8.Db.FromSql(`select sum(XiaofeiJF) from diy_JFXFMX where IsDeleted =0 and (HexiaoZT = '已完成' or HexiaoZT = '待评价' ) and ShanghuID = '${item.Id}' ` + where1).ToScalar()
  obj.ShanghuSK = obj.ShanghuSK || 0
// 订单数统计
  obj.DingDanShu = V8.Db.FromSql(`select Count(Id) from diy_JFXFMX where IsDeleted =0 and (HexiaoZT = '已完成' or HexiaoZT = '待评价' ) and ShanghuID = '${item.Id}' ` + where1).ToScalar()
  data.push(obj)
})
 
 
V8.Result = { Code : 1, Data : data, DataCount : Count}
```


レポート追加![レポートエンジン]

設計レポートレポートを追加した後、レポートデザインをクリックすると、対応するフォームデザイン領域に入ります。

![レポートエンジン]

左側で必要なスペースを選択して、中央のフォーム領域にドラッグできます。右側のフォームプロパティは、コントロールのフィールド属性を設定できます。
必要に応じて必要な検索条件コントロールを取り込んで、フローエンジンに検索条件コードを配置することもできます。

🌈注意: フィールド名はプロセスエンジンで取得したデータに対応する必要があります。

![レポートエンジン]

🌈注意: フィールド構成で、既存のテーブルのフィールドを選択するか、選択テーブルのすべてのフィールドを追加することもできます。

![レポートエンジン]

モジュールエンジンはレポートをページに割り当てます1. 如需添加二级菜单，打开方式选择 `SecondMenu`，添加表单选择 `Diy`。
2. 在自定义表中选择刚刚新增的报表，在界面模板中选择搜索 `+` 表格。
3. 排序则是在此父级菜单中的排序顺序，越小越靠前，不填默认为 `0` 。

![レポートエンジン]

権限の割り当て1. 在岗位角色中选择需要看到此报表的角色。
2. 在对应菜单中将其复选框勾上。
3. 点击保存。
4. 刷新浏览器，则可看到刚分配的报表引擎。

![レポートエンジン]