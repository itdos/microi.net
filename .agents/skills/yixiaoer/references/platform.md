# 平台定义 (Platform Definitions)
如无特殊声明，API 接口中 `platforms` 数组中需要填写的名称为**平台中文名**。

详细的发布接口结构请参考: [平台参考索引](./platforms/index.md)

## 平台标识枚举 (Platform Codes)

| 平台标识 (Code) | 平台中文名 (Name) |
| :--- | :--- |
| `DouYin` | `抖音` |
| `KuaiShou` | `快手` |
| `KuaiShou-Open` | `快手-Open` |
| `ShiPinHao` | `视频号` |
| `BiLiBiLi` | `哔哩哔哩` |
| `BiLiBiLi-Open` | `哔哩哔哩-Open` |
| `XiaoHongShu` | `小红书` |
| `BaiJiaHao` | `百家号` |
| `TouTiaoHao` | `头条号` |
| `XiGuaShiPin` | `西瓜视频` |
| `ZhiHu` | `知乎` |
| `QiEHao` | `企鹅号` |
| `XinLangWeiBo` | `新浪微博` |
| `SouHuHao` | `搜狐号` |
| `YiDianHao` | `一点号` |
| `DaYuHao` | `大鱼号` |
| `WangYiHao` | `网易号` |
| `AiQiYi` | `爱奇艺` |
| `TengXunWeiShi` | `腾讯微视` |
| `WeiXinGongZhongHao` | `微信公众号` |
| `WeiXin` | `微信` |
| `Tiktok` | `TikTok` |
| `Youtube` | `Youtube` |
| `Twitter` | `X` |
| `Facebook` | `Facebook` |
| `Instagram` | `Instagram` |
| `Other` | `其他账号` |
| `SouHuShiPin` | `搜狐视频` |
| `PiPiXia` | `皮皮虾` |
| `TengXunShiPin` | `腾讯视频` |
| `DuoDuoShiPin` | `多多视频` |
| `MeiPai` | `美拍` |
| `AcFun` | `AcFun` |
| `KuaiChuanHao` | `快传号` |
| `XueQiuHao` | `雪球号` |
| `CheJiaHao` | `车家号` |
| `XiaoHongShuShangJiaHao` | `小红书商家号` |
| `YiCheHao` | `易车号` |
| `FengWang` | `蜂网` |
| `DouBan` | `豆瓣` |
| `CSDN` | `CSDN` |
| `DeWu` | `得物` |
| `JianShu` | `简书` |
| `MeiYou` | `美柚` |
| `WeiXinGongZhongHao-Open` | `微信公众号-Open` |

## 平台类型枚举 (PlatformType)

| 值 (Value) | 定义 | 说明 |
| :--- | :--- | :--- |
| `0` | `Crawler` | 其他/爬虫账号 |
| `1` | `OpenPlatform` | 开放平台账号 |
| `2` | `Overseas` | 海外平台账号 |
