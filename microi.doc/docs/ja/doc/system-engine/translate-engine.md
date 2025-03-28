# 翻訳エンジン
## 介绍
> 公式ドキュメント: https://next.api.aliyun.com/api/alimt/2018-10-12/TranslateGeneral?tab=DOC&lang=CSHARP
```javascript
//每个函数最后一个V8.OsClient如果不传就默认使用主库的配置，传入对应saas就是使用对应saas库的数据或配置
//通过阿里云接口翻译
var a1 = V8.TranslateEngine.Translate('张三', 'en');//将【张三】翻译成【英语】
var a2 = V8.TranslateEngine.Translate('love', 'cn', 'en', V8.OsClient);//将【love】翻译成【中文】，并且设置源文字的语种为【en】
//从diy_lang表缓存中提取翻译
var a3 = V8.TranslateEngine.GetLang('NoAuth');
var a4 = V8.TranslateEngine.GetLang('NoLogin', 'cn');
var a5 = V8.TranslateEngine.GetLang('ParamError', 'cn', V8.OsClient);
var a6 = V8.TranslateEngine.GetLangCode('NoLogin');
var a7 = V8.TranslateEngine.GetLangCode('NoLogin', V8.OsClient);
var a8 = V8.TranslateEngine.GetLangData('NoLogin', V8.OsClient);
var a9 = V8.TranslateEngine.GetLang('NO0001', 'en');

return {
  a1 : a1,
  a2 : a2,
  a3 : a3,
  a4 : a4,
  a5 : a5,
  a6 : a6,
  a7 : a7,
  a8 : a8,
  a9 : a9
};
```