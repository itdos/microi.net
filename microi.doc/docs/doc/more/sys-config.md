# ⚙️ 系统设置

> **系统设置非常重要，开好数据库后第一件事就是配置系统设置**

---

## 公开配置与服务端私密配置

系统设置采用明确的双表边界：

- `sys_config` 保存需要向浏览器公开的租户配置。新增公开项必须创建真实物理字段和 `diy_field` 元数据；前端 `V8.SysConfig` 读取它的安全投影。
- `mci_system_setting` 只保存敏感配置或仅供后端使用的普通值。历史 `IsPublic` 字段已停用，任何记录都不会进入匿名 `GetSysConfig` 或浏览器。
- 后端接口引擎和后端 V8 事件仍可读取 `sys_config` 全部字段；私密值统一从 `V8.SysConfig.ServerPrivateSettings[ConfigKey]` 读取。禁止返回、记录或复制整个 `ServerPrivateSettings`。
- `mci_system_setting` 的 Secret 使用租户绑定认证加密，列表默认掩码；临时显示原文要求 Passkey、Authenticator 或严格人脸的一次性步进验证，并使用 `no-store`。

```js
// 前端或后端均可读取公开实体字段
var title = V8.SysConfig.SysTitle;

// 仅后端接口引擎、SubmitBeforeServerV8、SubmitAfterServerV8 等可信后端事件可用
var privateSettings = V8.SysConfig.ServerPrivateSettings || {};
var clientSecret = privateSettings['Login.Gitee.ClientSecret'];
// clientSecret 只能参与当前后端调用，禁止 return 或 console.log。
```

`FormMaskBlur` 是全局正向开关：缺失、空值或 `0/false` 默认关闭遮罩毛玻璃，只有显式 `1/true` 才开启。表级 `diy_table.DisableFormMaskBlur` 仍是负向开关；全局开启后，某张表显式配置 `1/true` 可单独关闭。旧 `sys_config.DisableFormMaskBlur` 只用于未升级租户的前端兼容回退，字段元数据必须在 PC 与移动端隐藏。

登录页入口统一使用 `DisableLoginPasskey`、`DisableLoginAuthenticator`、`DisableLoginGitee`、`DisableLoginWeChat`、`DisableLoginGitHub` 五个负向开关，字段标签分别为“关闭生物登录入口”“关闭Authenticator登录入口”“关闭Gitee登录入口”“关闭微信登录入口”“关闭GitHub登录入口”。它们缺失、空值或 `0/false` 时默认显示入口，只有显式 `1/true` 才关闭；旧 `Login*Display` 字段仅作兼容回退并隐藏。`DisableAiAssistant` 同样保持负向开关语义。

## 界面风格：框架来源标识与水印

微服务和定制组件的来源标识由吾码宿主统一渲染，子应用不需要自行实现，也不存在租户级显示开关。`RenderSourceBadgeMode` 已停用并从系统设置移除：来源标识始终可发现，避免用户在不知道内容来源的情况下误改宿主或子应用。

菜单微服务显示在框架内容区右上角并提供独立关闭按钮，用户认为它遮挡子应用控件时可仅关闭当前页面实例的标识；切换到另一个微服务页面后会重新显示，不会记住为全局关闭。`V8.OpenAppDialog` 打开的微服务或定制弹层把标识放在标准标题栏，因为它不会覆盖弹层正文和右上角操作区，所以始终显示且不提供关闭按钮。表单 `DevComponent` 显示在字段宿主，表格中的 `DevComponent` 只在列头显示一次，避免每行重复。

来源标识本身是可点击按钮。点击后由框架打开统一的大圆角详情弹层，展示应用标识、页面标识、应用内路由、框架路由、版本、源码定位、运行入口、发布/挂载状态和租户坐标，并生成一段可复制的 Microi MCP 修改指令。详情中的运行信息只显示公开定位数据，不展示 Token、访问密钥或私有配置值。

框架水印使用以下公开 `sys_config` 字段，覆盖整个 `100vw × 100vh`，包括路由内容和 Element Plus 弹层；水印层固定 `pointer-events:none`，不会阻止点击、滚动、拖拽、触摸或键盘操作，并自动适配亮色/深色主题。

| 字段 | 默认值 | 说明 |
|---|---|---|
| `FrameworkWatermarkEnabled` | `0` | 显式设为 `1/true` 才开启，保证旧租户升级后视觉不变 |
| `FrameworkWatermarkContent` | `$SysTitle$ - $UserName$` | 留空时显示“系统标题 - 用户名”；用户名为空自动回退 `$Account$`，两者均为空时只显示系统标题，不会输出 `undefined/null`。支持 `$SysTitle$`、`$SysShortTitle$`、`$UserName$`、`$Account$`、`$Date$`、`$DateTime$`，也支持 `{{UserName}}` 写法 |
| `FrameworkWatermarkDirection` | `DiagonalUp` | `DiagonalUp`（斜向上）、`DiagonalDown`（斜向下）、`Horizontal`（水平） |
| `FrameworkWatermarkOpacity` | `30` | 百分比；未设置、非法或为 `0` 时按 `30` 处理，运行时限制在 `1–100` |
| `FrameworkWatermarkDensity` | `Comfortable` | `Compact`、`Comfortable`、`Sparse` 三档重复间距 |
| `FrameworkWatermarkFontSize` | `14` | 像素；未设置、非法或为 `0` 时按 `14` 处理，运行时限制在 `8–72` |

水印内容只应使用系统标题、用户显示名、账号、日期等公开展示信息，不要填写 Token、密码、Secret、手机号等敏感值。保存系统设置后会沿用现有 `sys_config` 缓存失效机制；刷新页面即可按最新配置重建框架水印。

“界面风格”是一级 Tab，内部继续使用“主题与导航 / 登录界面与入口 / AI 与框架水印”等 `CollapseGroup` 归类设置。新增界面配置时应放入相应折叠组，不能继续把大量开关直接平铺在 Tab 中。

---

## 🔐 验证码

### 获取验证码图片
::: details 展开查看 JavaScript 代码（24 行）
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
:::
---

### 提交验证码
```js
//参数传入_CaptchaId、_CaptchaValue
```
---

### 验证码配置
::: details 展开查看 JSON 配置（24 行）
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
:::
|CaptchaType|字体|静态图|动图|
|:--:|:--:|:--:|:--:|
| DEFAULT (0) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987335545209958389942.gif/20230909/1.gif" data-fancybox="gallery" alt="DEFAULT 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987336384782028080986.gif/20230909/2.gif" data-fancybox="gallery" alt="DEFAULT 动态验证码示例" width=130> |
| CHINESE (1) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987348140208461391418.gif/20230909/2-1.gif" data-fancybox="gallery" alt="CHINESE 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987348878749178882619.gif/20230909/2-2.gif" data-fancybox="gallery" alt="CHINESE 动态验证码示例" width=130> |
| NUMBER (2) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987351081492956070489.gif/20230909/3-1.gif" data-fancybox="gallery" alt="NUMBER 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987351833418265739934.gif/20230909/3-2.gif" data-fancybox="gallery" alt="NUMBER 动态验证码示例" width=130> |
| NUMBER_ZH_CN (3) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987352637251001802115.gif/20230909/4-1.gif" data-fancybox="gallery" alt="NUMBER_ZH_CN 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987353340272558580529.gif/20230909/4-2.gif" data-fancybox="gallery" alt="NUMBER_ZH_CN 动态验证码示例" width=130> |
| NUMBER_ZH_HK (4) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987354240120153944859.gif/20230909/5-1.gif" data-fancybox="gallery" alt="NUMBER_ZH_HK 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987355024308308067930.gif/20230909/5-2.gif" data-fancybox="gallery" alt="NUMBER_ZH_HK 动态验证码示例" width=130> |
| WORD (5) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987356231940556741541.gif/20230909/6-1.gif" data-fancybox="gallery" alt="WORD 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987356971159357182120.gif/20230909/6-2.gif" data-fancybox="gallery" alt="WORD 动态验证码示例" width=130> |
| WORD_LOWER (6) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987357903149398401416.gif/20230909/7-1.gif" data-fancybox="gallery" alt="WORD_LOWER 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987358559208156725035.gif/20230909/7-2.gif" data-fancybox="gallery" alt="WORD_LOWER 动态验证码示例" width=130> |
| WORD_UPPER (7) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987359347923562585116.gif/20230909/8-1.gif" data-fancybox="gallery" alt="WORD_UPPER 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987368351564882713778.gif/20230909/8-2.gif" data-fancybox="gallery" alt="WORD_UPPER 动态验证码示例" width=130> |
| WORD_NUMBER_LOWER (8) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987369066747495961267.gif/20230909/9-1.gif" data-fancybox="gallery" alt="WORD_NUMBER_LOWER 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987369777462003187163.gif/20230909/9-2.gif" data-fancybox="gallery" alt="WORD_NUMBER_LOWER 动态验证码示例" width=130> |
| WORD_NUMBER_UPPER (9) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987375136845773128473.gif/20230909/10-1.gif" data-fancybox="gallery" alt="WORD_NUMBER_UPPER 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987375867861808167519.gif/20230909/10-2.gif" data-fancybox="gallery" alt="WORD_NUMBER_UPPER 动态验证码示例" width=130> |
| ARITHMETIC (10) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987376677516548099905.gif/20230909/11-1.gif" data-fancybox="gallery" alt="ARITHMETIC 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987377367742808615156.gif/20230909/11-2.gif" data-fancybox="gallery" alt="ARITHMETIC 动态验证码示例" width=130> |
| ARITHMETIC_ZH (11) |   | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987378101506678680095.gif/20230909/12-1.gif" data-fancybox="gallery" alt="ARITHMETIC_ZH 静态验证码示例" width=130> | <img src="https://static.itdos.com/itdos/itdos/upload/editor/image/202309/6382987378730926385837508.gif/20230909/12-2.gif" data-fancybox="gallery" alt="ARITHMETIC_ZH 动态验证码示例" width=130> |
