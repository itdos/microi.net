# レポートエンジン

## 紹介
レポートエンジンは「データソースエンジンインタフェースエンジンフォームエンジンモジュールエンジン」の組み合わせで実現され、現在は一時的に表表現形式しかサポートしていない`ECharts`グラフィック展示形式は開発中です。

## 機能のハイライト
1.完全にカスタマイズされた追加、削除、変更、調査をサポートする: 一般的な統計レポートデータは複数のテーブルに由来しており、追加、修正、削除を実行する際に複数のテーブルを操作する必要がある場合がありますインタフェースエンジンのトランザクションで実現できます。
2.レポートはすべて仮想を生成します`diy_table`テーブル、バーチャル`diy_field`フィールド
3.レポートは、独立したフォーム設計 (仮想フィールド) をサポートしています
4.【モジュールエンジン】をサポートして、レポートのクエリ列、編集可能列、検索可能列などを設定します

## 表レポートを作成します

1.データソースエンジンを作成します。現在、レポートエンジンには、データソースサポートを提供するデータソースエンジンが必要です。データソースのサポート`SQL、V8、JSON`(古いバージョンのデータソースタイプに中国語が含まれている場合は、この3つを大文字に変更してください)
2.レポートエンジンを作成します。適切なデータソースを選択し、保存してから表示するフィールドを設定します
3.「モジュールエンジンDIY」にモジュールを追加し、開く方法を選んで「DIY」を選ぶ。自動的に生成されたばかりの仮想レポートを選択します
4.【レポートエンジン】の設計で、【問合せインタフェースの置換、新規インタフェースの置換、インタフェースの置換の変更、インタフェースの置換の削除】をインタフェースエンジンに対応する実装インタフェースに変更します (例:`/apiengine/get_webuser_info`)

## 実現効果の展示

取引先は商店街の小さなプログラムで、小さなプログラムで買い物をするとポイントが得られ、このレポートには各マーチャントが生成したポイント消費注文数ポイント消費統計が記録されている。

頭部のマーチャント名、注文時間で検索フィルタリングを行い、所定時間内のポイント注文統計を動的に統計することができる。


![レポートエンジン]

## 実現手順

### データソースエンジンの追加
データソースエンジンに新しいデータソースを追加して、レポートのデータを統計します。実装コードは次のとおりです

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
return { Code : 1, Data : data, DataCount : Count}
```

### レポート追加

![レポートエンジン]

### 設計レポート
レポートを追加した後、レポートデザインをクリックすると、対応するフォームデザイン領域に入ります。

![レポートエンジン]

左側で必要なスペースを選択して、中央のフォーム領域にドラッグできます。右側のフォームプロパティは、コントロールのフィールド属性を設定できます。
必要に応じて必要な検索条件コントロールを取り込んで、フローエンジンに検索条件コードを配置することもできます。

>🌈注意: フィールド名はプロセスエンジンで取得したデータに対応する必要があります。

![レポートエンジン]

🌈注意: フィールド構成で、既存のテーブルのフィールドを選択するか、選択テーブルのすべてのフィールドを追加することもできます。

![报表引擎](/api_plugins/report05.png)

## モジュールエンジンはレポートをページに割り当てます

1.二次メニューを追加するには、方法の選択を開きます`SecondMenu`、フォーム選択を追加`Diy`。
2.カスタムテーブルで新しく追加したばかりのレポートを選択し、インタフェーステンプレートで検索を選択します`+`テーブル。
3.ソートはこの親メニューのソート順です。小さいほど前に進みます。デフォルトは入力しません。`0`。

![报表引擎](/api_plugins/report06.png)

## 権限の割り当て

1.職場の役割で、このレポートを見る必要がある役割を選択します。
2.対応するメニューでチェックボックスをオンにします。
3.保存をクリックします。
4.ブラウザを更新すると、割り当てられたばかりのレポートエンジンが表示されます。

![报表引擎](/api_plugins/report07.png)