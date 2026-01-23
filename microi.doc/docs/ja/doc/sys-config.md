# システム設定
> * システム設定は非常に重要で、データベースを開くには、最初にシステム設定を構成することです
## 認証コード
### 認証コード画像の取得
```js
//通过浏览器测试：
https://api.microios.com/api/Captcha/getCaptcha?OsClient=micrios
//通过查看元素，可在Response Headers中看到返回了captchaid，在提交验证码时，此值必须传入到后端。
//在PC前端或Uni-App移动端的处理方式大致为：
<img id="CaptchaImg" src="" @click="GetCaptcha()" />
GetCaptcha(){
    $axios.get(self.DiyCommon.GetApiBase() + '/api/Captcha/getCaptcha', {
        params: {
            OsClient : self.OsClient//一定要传入OsClient值
        },
        responseType: 'arraybuffer'
    })
    .then(response => {
        if(response && response.headers && response.headers.captchaid){
            self.CaptchaId = response.headers.captchaid;//一定要将返回的captchaid存储起来
        }
        return 'data:image/png;base64,' + btoa(
            new Uint8Array(response.data)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
    }).then(data => {
          $('#CaptchaImg').attr('src', data);//显示验证码图片
    });
}
```
### 認証コードの提出
```js
//参数传入_CaptchaId、_CaptchaValue
```
### 認証コード設定
```json
{
    "CaptchaType": 11, // 验证码类型，值为0-11，具体效果见平台文档
    "CodeLength": 1, // 验证码长度, 要放在CaptchaType设置后。当类型为算术表达式时（CaptchaType=10-11），长度代表操作的个数, 建议1。当CaptchaType=0-9时建议填4。
    "ExpirySeconds": 300, // 验证码过期秒数
    "IgnoreCase": true, // 比较时是否忽略大小写
    //"StoreageKeyPrefix": "", // 存储键前缀
    "ImageOption": {
        "Animation": true, // 是否启用动画
        "FontSize": 32, // 字体大小
        "Width": 150, // 验证码宽度
        "Height": 50, // 验证码高度
        "BubbleMinRadius": 5, // 气泡最小半径
        "BubbleMaxRadius": 10, // 气泡最大半径
        "BubbleCount": 3, // 气泡数量
        "BubbleThickness": 1.0, // 气泡边沿厚度
        "InterferenceLineCount": 2, // 干扰线数量
        //"FontFamily": "kaiti", //【暂不支持】 包含actionj,epilog,fresnel,headache,lexo,prefix,progbot,ransom,robot,scandal,kaiti
        "FrameDelay": 300, // 每帧延迟,Animation=true时有效, 默认30，建议300左右
        //"BackgroundColor": "#ffffff", //【暂不支持】  格式: rgb, rgba, rrggbb, or rrggbbaa format to match web syntax, 默认#fff
        "ForegroundColors": "", //  颜色格式同BackgroundColor,多个颜色逗号分割，随机选取。不填，空值，则使用默认颜色集
        "Quality": 100, // 图片质量（质量越高图片越大，gif调整无效可能会更大）
        "TextBold": false // 粗体
    }
}
```
| CaptchaType | フォント | 静的図 | 動図 |
|:--:|:--:|:--:|:--:|
| デフォルト (0) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987335545209958389942.gif/20230909/1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987336384782028080986.gif/20230909/2.gif" data-fancybox="gallery" alt="" width=130> |
| China (1) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987348140208461391418.gif/20230909/2-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987348878749178882619.gif/20230909/2-2.gif" data-fancybox="gallery" alt="" width=130> |
| NUMBER (2) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987351081492956070489.gif/20230909/3-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987351833418265739934.gif/20230909/3-2.gif" data-fancybox="gallery" alt="" width=130> |
| Number _ zh_cn (3) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987352637251001802115.gif/20230909/4-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987353340272558580529.gif/20230909/4-2.gif" data-fancybox="gallery" alt="" width=130> |
| Number _ zh_hk (4) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987354240120153944859.gif/20230909/5-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987355024308308067930.gif/20230909/5-2.gif" data-fancybox="gallery" alt="" width=130> |
| WORD (5) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987356231940556741541.gif/20230909/6-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987356971159357182120.gif/20230909/6-2.gif" data-fancybox="gallery" alt="" width=130> |
| Word _ low er (6) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987357903149398401416.gif/20230909/7-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987358559208156725035.gif/20230909/7-2.gif" data-fancybox="gallery" alt="" width=130> |
| Word _ upper (7) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987359347923562585116.gif/20230909/8-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987368351564882713778.gif/20230909/8-2.gif" data-fancybox="gallery" alt="" width=130> |
| Word _ number _ low er (8) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987369066747495961267.gif/20230909/9-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987369777462003187163.gif/20230909/9-2.gif" data-fancybox="gallery" alt="" width=130> |
| Word _ number _ upper (9) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987375136845773128473.gif/20230909/10-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987375867861808167519.gif/20230909/10-2.gif" data-fancybox="gallery" alt="" width=130> |
| ARITHMETIC (10) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987376677516548099905.gif/20230909/11-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987377367742808615156.gif/20230909/11-2.gif" data-fancybox="gallery" alt="" width=130> |
| Arithmetic _ zh (11) |  | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987378101506678680095.gif/20230909/12-1.gif" data-fancybox="gallery" alt="" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987378730926385837508.gif/20230909/12-2.gif" data-fancybox="gallery" alt="" width=130> |