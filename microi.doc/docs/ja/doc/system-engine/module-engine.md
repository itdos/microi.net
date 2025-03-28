# モジュールエンジン
## 紹介
> モジュールエンジンには、モジュール構成、データソース構成、インタフェース置換、動的ボタンなどの構成が含まれています

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/a1501c7cf43c402eb961952ec2619f43.png#pic_center)
## モジュール設定
## 開く方法
>* ** Diy **: フォームエンジンでレンダリングし、開くのはテーブルです

>* ** Component **: カスタムvueコンポーネントで開き、カスタムコンポーネントのパスを入力する必要があります

>* ** Iframe **: iframeモードで開きます

>* ** Second dmenu **: サブメニューを含む上位メニュー

>* ** Report **: 仮想レポート

## データソース設定
>* ** 関連テーブル **:joinテーブル、テーブルの別名を設定します

>* ** クエリ列 **:selectのフィールド

>* ** 列を表示しません **: 一部のidフィールドはselect后にテーブルに表示する必要はありません

>* ** ソート可能な列 **: ソートできるフィールド

>* ** デフォルトのソート列 **: デフォルトのマルチフィールドソート

>* ** 検索可能な列 **: 検索できるフィールド

>* ** 統計列 **: 統計が必要なフィールド

>* ** テーブル内編集をオンにする **: テーブル内編集をオンにすると、編集可能な列も設定する必要があります

>* ** Join関連 **: 関連表を自由に作成する条件

>* ** Where条件 **: where条件を自由に作成し、権限管理を実現します

>* ** インポートテンプレート **: インポートテンプレートを作成して、ユーザーにダウンロードしてもらう

>* ** 表の改ページ番号が増加しました **: 最初のページ番号以外はページ番号を継承します。

## インタフェース置換
>* ** 照会インタフェース置換 **

>* ** [新規追加] モード **
> サポート ** 弾倉 ** と ** 表内 **

>* ** インポートインタフェースの置き換え **
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

//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + "：已读取【" + dataList.Data.length + "】条数据！");
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：已导入【0】条数据...`);
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));

dataList.Data.forEach((item, index) => {
  //循环导入数据
  var addResult = V8.FormEngine.AddFormData('tableName', item, V8.DbTrans);
  if(addResult.Code != 1){
    V8.DbTrans.Rollback();//回滚
    V8.Cache.Set(isImportingKey, '0');//取消标记正在导入
    //写进度
    importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：导入出现错误：${addResult.Msg}。已回滚！`);
    V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
    break;
  }
  //写进度（覆盖上一条）
  importStepList[importStepList.length - 1] = DateNow('yyyy-MM-dd HH:mm:ss') + `：已导入【${index+1}】条数据...`;
  V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
});
V8.DbTrans.Commit();//提交
//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：导入成功，已结束！`);
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
V8.Cache.Set(isImportingKey, '0');//取消标记正在导入
return { Code : 1 };
```

>* ** 進捗インタフェースのインポート **
```js
if(!V8.Param.TableId){
    return { Code : 0, Message : '必须指定一个TableId，以标记要获取哪张表的导入进度！' }
}
//获取进度
var importStepStr = V8.Cache.Get(`Microi:${V8.OsClient}:ImportTableDataStep:${V8.Param.TableId}`);
return { Code 1, Data : JSON.parse(importStepStr) };
```

>* ** エクスポートインタフェース置換 **: 関連記事を参照:
>[Microi吾コード-カスタムエクセル](https://microi.blog.csdn.net/article/details/143619083)
> [Micori吾コード-インターフェースエンジンを使ってカスタムエクスポートエクセルを実現する](https://microi.blog.csdn.net/article/details/143849425)

## 動的ボタン
>* ** フォームより多くのボタン **

>* ** 行のボタン **

>* ** その他のエクスポートボタン **

>* ** より多くのボタンを一括選択 **

>* ** ページより多くのボタン **

>* ** ページマルチTab **
