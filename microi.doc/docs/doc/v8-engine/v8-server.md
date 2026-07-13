# 🖥️ V8 函数列表 - 后端

> **服务器端 V8 引擎支持 ES6 语法，集成后端对象和方法**

---

## 📌 介绍

- 服务器端 V8 引擎代码与前端 V8 的编程语言均为 JavaScript 语法
- 服务器端 V8 引擎支持 ES6 语法
- 集成了后端对象、方法，可使用 JS 调用后端方法（非 HTTP）
- 服务器端 V8 代码在服务器端执行
- 主要用于表单属性的服务器端 V8 事件、接口引擎、数据源引擎等

## 接口引擎 V8.ApiEngine
>* [接口引擎详细介绍](https://microi.net/doc/v8-engine/api-engine)
>* 服务器端V8事件可以直接调用接口引擎（非http），接口引擎也可以调用接口引擎
>* V8事件或接口引擎在调用另外一个接口引擎时，可传入事件对象，即可保证在同一事务
```javascript
//调用方式：
var result = V8.ApiEngine.Run('ApiEngineKey', { 
    Param1 : '1',
});
//同一事务
var resul2 = V8.ApiEngine.Run('ApiEngineKey', { 
    Param2 : '1',
}， V8.DbTrans);
```

## 表单引擎 V8.FormEngine
>* 见平台文档：[FormEngine用法](https://microi.net/doc/v8-engine/form-engine.html)

## 缓存操作 V8.Cache
>* 平台分布式缓存是L1、L2级联动的分布式缓存，L1为本地内存缓存，L2为redis缓存，V8.Cache操作的就是L2级redis缓存，平台会自动管理L1和L2的联动关系。当覆盖数据库、或直接修改数据库表结构数据后，可能需要手动重启api的docker容器以实现自动清除L1级缓存，然后可通过redis desktop manage软件清除L2级缓存。
>* 分布式缓存操作类，用法V8.Cache('Key', 'Value', '0.00:10:00');
>* 注意：过期时间的格式必须是`d.HH:mm:ss`，如`0.12:00:00`0天12小时，`1.10:10:00`一天10小时10分钟，也可以不传过期时间参数，则为永久。
>* 建议使用的缓存Key命名规则为：`Microi:${V8.OsClient}:{分类key值}:{Key}`，这样与平台的缓存Key命名规则一致，方便查看，并且区分SaaS租户，防止缓存混乱
```javascript
var cacheKey = `Microi:${V8.OsClient}:FormData:baoming`;
var cacheValue = JSON.stringify(formData);
//写缓存
var result1 = V8.Cache.Set(cacheKey, cacheValue, '0.00:00:59');//返回bool类型
//获取缓存
var result2 = V8.Cache.Get(cacheKey);//返回string类型，无缓存返回null
//删除缓存。注：若在Set时设置了有效期，到期会自动删除。
var result3 = V8.Cache.Remove(cacheKey);//返回bool类型
```
* 验证码缓存Key命名规则：
```
`Microi:${OsClient值}:{分类key值}:{Key}`
示例：
`Microi:iTdos:Captcha:aaaa-bbbb-cccc`
```
* 平台的redis key前缀只总有4级：
>* 第一级用于区分其它第三方系统共用同一个redis实例时，区分哪个redis文件夹是吾码平台在用的
>* 第二级用于区分saas租户
>* 第三级用于区分redis分类，比如说验证码一类
>* 第四级就是最终要用的key

## C#系统类 System
>* 服务器端V8代码能直接使用.net下的System命名空间
::: details 展开查看 C# 代码（39 行）
```csharp
//生成一个服务器端GUID值
//强烈建议使用 V8.Method.NewUlid() 方法替代 System.Guid.NewGuid()，Ulid 具有更好的排序性和更短的字符串长度
System.Guid.NewGuid()


//将字符串转为base64字符串，建议使用后封装的V8.Base64
var bytes = System.Text.Encoding.UTF8.GetBytes(originalString);  
var base64String = System.Convert.ToBase64String(bytes);

//解密base64，，建议使用后封装的V8.Base64
var bytes = System.Text.Encoding.UTF8.GetBytes(originalString);  
var base64String = System.Convert.ToBase64String(bytes);

//等待1000毫秒
System.Threading.Thread.Sleep(1000);

//调用服务器端全局V8函数，获取yyyy-MM-dd HH:mm:ss格式的当前时间字符串。若获取日期格式，可使用new Date();
V8.Action.GetDateTimeNow()

//如果在服务器端全局V8函数是通过function DateNow(){}这样定义的，则可以直接使用DateNow()
var nowDate = DateNow('yyyy_mm-dd HH:mm:ss');

//异步执行V8代码，方法1（推荐）
var timer1 = setTimeout(function() {
    V8.FormEngine.UptFormData('diy_test1', {
      Id : '8007f94b-4883-4a0c-8c23-f25aca910722'
      Text45 : '2222',
    });
}, 1000);
//可在timer1开始执行前随时手动提前终止定时执行
clearTimeout(timer1);

//异步执行V8代码，方法2
System.Threading.Tasks.Task.Run(function(){
  //实现setTimeout(function, 1000)的效果，不加则是setTimeout(function, 0)的异步效果
  System.Threading.Thread.Sleep(1000);
  V8.FormEngine.UptFormData('diy_test1', {
    Id : '8007f94b-4883-4a0c-8c23-f25aca910722'
    Text45 : '2222',
  });
});
```
:::

## 常用函数 V8.Method
>* 集成了一些常用函数，可自定义扩展
::: details 展开查看 JavaScript 代码（26 行）
```javascript
//从redis中获取当前登陆用户的token和身份信息
//token：可选，是否包含Bearer均支持
//osClient：可选
var currentTokenObj = V8.Method.GetCurrentToken(token, osClient)
//返回：{ OsClient : '', CurrentUser : {}, Token : '不包含 Bearer ' } 或 null

//刷新用户的登陆身份redis缓存信息，必传userId、osClient
V8.Method.RefreshLoginUser(userId, osClient)

//获取私有文件的临时访问地址，可传入FilePathName、或FilePathNames
V8.Method.GetPrivateFileUrl()
var result = V8.Method.GetPrivateFileUrl({
    FilePathName : '/microi/file/2023-08-06/xxx.doc',
    //FilePathNameS : ['/microi/file/2023-08-06/xxx.doc']
});
//返回{ Code : 1/0, Data : '临时访问地址'/['临时访问地址'], Msg : '错误信息' }

//添加系统日志
V8.Method.AddSysLog({
	Type : '', //日志类型，自定义文字，如：接口日志、性能日志、登录日志等
	Title : '', //日志标题，如：张三登录了系统
	Content: '', //日志内容，如：张三在2024-12-12 20:13通过扫码登录了系统 
	OtherInfo : '', //其它信息，如：{ Append : 'test' }
	Remark : '', //日志备注
	Level : 1,//日志等级
});
```
:::

## V8.Base64
>* Base64转换，与System.Convert.ToBase64String(bytes)不同的是V8.Base64若遇异常会直接返回源字符串
```javascript
var result = V8.Base64.StringToBase64('123456');
var result = V8.Base64.Base64ToString('MTIzNDU2');
```

## 图像处理 V8.Image

`V8.Image` 提供跨平台的服务端图片生成、合并和编辑能力。所有方法都以对象形式传参，只处理内存中的 `Base64`、Data URI 或字节数组，不直接读取本地路径，也不会主动访问 URL。

### 图片来源与返回值

图片来源支持以下形式：

```javascript
// 顶层 Base64
{ FileByteBase64: '<base64>' }

// 等价字段
{ Base64: '<base64>' }
{ DataUrl: 'data:image/png;base64,...' }
{ Bytes: response.RawBytes }

// 单图方法也支持 Image / Source 嵌套，值可以是对象或字符串
{ Image: { FileByteBase64: '<base64>' } }
{ Source: '<base64>' }
```

处理成功时，除 `GetInfo` 外均返回标准 `DosResult`：

```javascript
{
  Code: 1,
  Data: {
    FileName: 'image.png',
    ContentType: 'image/png',
    FileByteBase64: '<base64>',
    Width: 800,
    Height: 600,
    Size: 12345,
    Format: 'png'
  },
  Msg: ''
}
```

每次调用后必须先判断 `Code`。接口引擎开启“响应文件”后，可以直接返回这个结果，在浏览器中预览或下载图片。

公共输出参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `OutputFormat` / `Format` | `png` | 支持 `png`、`jpeg` / `jpg`、`webp`、`bmp`；`OutputFormat` 优先 |
| `Quality` | `90` | 编码质量，运行时限制到 1 至 100 |
| `BackgroundColor` | 透明；JPEG 为白色 | 画布背景色 |
| `FileName` | `image.<扩展名>` | 输出文件名，扩展名会按真实格式修正 |

兼容公共别名：`ImageFormat` / `OutputType` → `OutputFormat`，`Background` / `BgColor` → `BackgroundColor`，单图方法的 `ImageBase64` → `FileByteBase64`。

### 方法列表

| 方法 | 说明 |
|------|------|
| `V8.Image.Create(param)` | 生成纯色、渐变、文字或基础图形图片 |
| `V8.Image.Merge(param)` | 横向、纵向、网格或覆盖合并图片 |
| `V8.Image.Overlay(param)` | 覆盖合并快捷方法，未设置模式时自动使用 `overlay` |
| `V8.Image.Resize(param)` | 调整宽高 |
| `V8.Image.Crop(param)` | 裁剪矩形区域 |
| `V8.Image.Rotate(param)` | 旋转图片 |
| `V8.Image.Flip(param)` | 水平或垂直翻转 |
| `V8.Image.Convert(param)` | 转换图片编码格式 |
| `V8.Image.Draw(param)` | 在已有图片上绘制文字和图形 |
| `V8.Image.Watermark(param)` | 添加图片水印 |
| `V8.Image.CreateQRCode(param)` | 生成二维码 |
| `V8.Image.GetInfo(param)` | 读取宽高、格式、帧数等信息 |

`Create` 的专用参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `Width` / `Height` | `800` / `600` | 新画布宽高 |
| `CanvasWidth` / `CanvasHeight` | 未设置 | 设置后分别覆盖 `Width` / `Height` |
| `BackgroundColorEnd` | 未设置 | 设置后与 `BackgroundColor` 形成线性渐变 |
| `GradientDirection` | `left-to-right` | 支持横向、`top-to-bottom` / `vertical`、`diagonal` |
| `Text` / `TextColor` / `FontSize` / `FontFamily` | 未设置 / `#111827` / `32` / 默认字体 | 在画布中心追加快捷文字 |
| `Elements` | 未设置 | 文字、矩形、椭圆、圆形和线段列表 |

### 生成图片并覆盖合并

下面示例先生成大图和小图，再把小图覆盖到大图的指定坐标。覆盖模式按 `ZIndex` 从小到大绘制，数值更大的图层位于上方；相同 `ZIndex` 时数组中靠后的图层位于上方。

```javascript
var baseResult = V8.Image.Create({
  Width: 1200,
  Height: 700,
  BackgroundColor: '#2563eb',
  BackgroundColorEnd: '#0f172a',
  GradientDirection: 'left-to-right',
  Text: 'Microi',
  TextColor: '#ffffff',
  FontSize: 72,
  FileName: 'poster.png'
});
if (baseResult.Code !== 1) return baseResult;

var badgeResult = V8.Image.Create({
  Width: 240,
  Height: 120,
  BackgroundColor: '#f97316',
  Text: 'NEW',
  TextColor: '#ffffff',
  FontSize: 42
});
if (badgeResult.Code !== 1) return badgeResult;

var result = V8.Image.Overlay({
  CanvasWidth: 1200,
  CanvasHeight: 700,
  Images: [
    {
      FileByteBase64: baseResult.Data.FileByteBase64,
      Width: 1200,
      Height: 700,
      Fit: 'fill',
      ZIndex: 0
    },
    {
      FileByteBase64: badgeResult.Data.FileByteBase64,
      X: 900,
      Y: 80,
      Scale: 0.75,
      Opacity: 0.95,
      CornerRadius: 16,
      ZIndex: 10
    }
  ],
  OutputFormat: 'png',
  FileName: 'poster-with-badge.png'
});
return result;
```

也可以使用双图简写：

```javascript
return V8.Image.Overlay({
  BaseImage: baseResult.Data.FileByteBase64,
  OverlayImage: badgeResult.Data.FileByteBase64,
  X: 900,
  Y: 80,
  OverlayWidth: 180,
  OverlayHeight: 90,
  Opacity: 0.9
});
```

主图兼容 `BaseImage`、`BackgroundImage`、`FirstImage`、`Base`；覆盖图兼容 `OverlayImage`、`ForegroundImage`、`SecondImage`、`Overlay`。简写结构中的顶层 `X`、`Y`、`Position`、`Opacity`、`OverlayWidth`、`OverlayHeight`、`Scale` 会应用到覆盖图。

### 合并模式

```javascript
// 左右拼接
var horizontal = V8.Image.Merge({
  Mode: 'horizontal',
  Direction: 'ltr',
  Gap: 20,
  Padding: 20,
  Alignment: 'center',
  Images: [
    { FileByteBase64: firstBase64, Height: 320 },
    { FileByteBase64: secondBase64, Height: 320 }
  ]
});

// 上下拼接
var vertical = V8.Image.Merge({
  Mode: 'vertical',
  Direction: 'ttb',
  Gap: 16,
  Alignment: 'left',
  Images: [firstBase64, secondBase64]
});

// 网格拼接
var grid = V8.Image.Merge({
  Mode: 'grid',
  Columns: 3,
  Gap: 12,
  Padding: 12,
  Images: imageBase64List
});
```

| 参数 | 说明 |
|------|------|
| `Mode` | `horizontal`、`vertical`、`grid`、`overlay` |
| `Layout` | 优先于 `Mode`；支持 `row`、`column`、`canvas`、`cover`，以及 `left/right/top/bottom/up/down` 方向快捷值 |
| `Direction` | `ltr`、`rtl`、`ttb`、`btt`，也支持 `left-to-right` 等完整写法 |
| `Images` / `Layers` | 图片或图层数组；数组项可以直接是 Base64 / Data URI 字符串 |
| `CanvasWidth` / `CanvasHeight` | 固定画布尺寸；未设置时按布局自动计算 |
| `Padding` / `Gap` | 内边距 / 图片间距，负数按 0 处理 |
| `Alignment` | 横向时控制上下对齐，纵向时控制左右对齐，网格时控制单元格内对齐 |
| `Columns` | 网格列数 |

合并兼容别名：`MergeType` / `Type` → `Mode`，`Items` → `Images`。

### 图层参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `Width` / `Height` | 原尺寸 | 只设置一个时按比例计算另一个 |
| `Scale` | `1` | 在宽高计算后再次按比例缩放，范围大于 0 且不超过 100 |
| `Fit` | `contain` | 同时设置宽高时支持 `contain`、`cover`、`fill` / `stretch`、`none` |
| `X` / `Y` | 未设置 | 覆盖模式绝对坐标；设置其中一个后，另一个默认使用 `Padding` |
| `Position` / `Anchor` | `top-left` | 未设置坐标时的锚点；`Position` 优先 |
| `OffsetX` / `OffsetY` | `0` | 坐标或锚点定位后的偏移 |
| `Opacity` | `1` | 透明度，限制到 0 至 1 |
| `Rotation` | `0` | 顺时针旋转角度 |
| `ZIndex` | `0` | 覆盖顺序，数值越大越靠上 |
| `FlipHorizontal` / `FlipVertical` | `false` | 翻转当前图层 |
| `CropX` / `CropY` / `CropWidth` / `CropHeight` | 原图范围 | 缩放前裁剪源图 |
| `CornerRadius` | `0` | 圆角半径 |
| `BorderColor` / `BorderWidth` | 未设置 / `0` | 图层边框 |
| `BlendMode` | `src-over` | 混合模式 |

`contain` 保持完整内容并等比缩放；`cover` 居中裁剪并填满目标宽高；`fill` / `stretch` 强制拉伸；`none` 使用原尺寸。`Scale` 在上述计算后继续生效。

常用锚点：`top-left`、`top`、`top-right`、`left`、`center`、`right`、`bottom-left`、`bottom`、`bottom-right`。混合模式支持 `src-over`、`multiply`、`screen`、`overlay`、`darken`、`lighten`、`plus` / `add`、`src`、`dst-over`。

图层兼容别名：`Order` → `ZIndex`、`Alpha` → `Opacity`、`Rotate` → `Rotation`、`Left` / `Top` → `X` / `Y`。

### 其它图片操作

```javascript
// 缩放：Width、Height 至少设置一个；Pad=true 时保留完整目标画布
var resized = V8.Image.Resize({
  Image: sourceBase64,
  Width: 800,
  Height: 600,
  Fit: 'cover',
  Pad: false,
  AllowUpscale: true,
  Alignment: 'center'
});

// 裁剪；Clamp=true 时把部分越界区域收缩到图片范围
var cropped = V8.Image.Crop({
  Image: sourceBase64,
  X: 100,
  Y: 80,
  Width: 640,
  Height: 360,
  Clamp: false
});

// 旋转；Expand=false 时保持原画布，边缘可能被裁掉
var rotated = V8.Image.Rotate({
  Image: sourceBase64,
  Degrees: 30,
  Expand: true
});

// 水平、垂直翻转；Horizontal 默认 true，Vertical 默认 false
var flipped = V8.Image.Flip({
  Image: sourceBase64,
  Horizontal: true,
  Vertical: false
});

// 格式转换
var converted = V8.Image.Convert({
  Image: sourceBase64,
  OutputFormat: 'webp',
  Quality: 85,
  FileName: 'converted.webp'
});

// 图片水印
var watermarked = V8.Image.Watermark({
  BaseImage: sourceBase64,
  Watermark: logoBase64,
  Width: 180,
  Height: 90,
  Scale: 1,
  Position: 'bottom-right',
  Margin: 24,
  OffsetX: 0,
  OffsetY: 0,
  Opacity: 0.7,
  Rotation: 0
});

// 二维码；Content 优先于 Text，Size 默认 300
var qr = V8.Image.CreateQRCode({
  Content: 'https://microi.net/',
  Size: 420,
  FileName: 'qrcode.png'
});

// 读取原始图片信息
var info = V8.Image.GetInfo({ Image: sourceBase64 });
// Data: Width、Height、Format、ContentType、Size、FrameCount、
// RepetitionCount、Origin、HasAlpha
```

`Watermark` 的 `BaseImage` 也可写为 `Image`，兼容 `Base` → `BaseImage`、`Overlay` → `Watermark`。

### 绘制文字和图形

`Create` 和 `Draw` 使用相同的 `Elements`。`Create` 在新画布上绘制；`Draw` 在输入图片上绘制，输出宽高与原图相同。

```javascript
var result = V8.Image.Draw({
  Image: sourceBase64,
  Elements: [
    {
      Type: 'text',
      X: 40,
      Y: 40,
      Text: 'CONFIDENTIAL',
      Color: 'rgba(239,68,68,0.75)',
      FontSize: 36,
      FontFamily: 'Arial',
      FontStyle: 'bold-italic',
      Align: 'left',
      VerticalAlign: 'top',
      Rotation: -8
    },
    {
      Type: 'round-rect',
      X: 40,
      Y: 90,
      Width: 320,
      Height: 100,
      FillColor: '#ffffff88',
      StrokeColor: '#ef4444',
      StrokeWidth: 3,
      CornerRadius: 16,
      Opacity: 0.9
    },
    {
      Type: 'line',
      X: 40,
      Y: 220,
      X2: 360,
      Y2: 220,
      StrokeColor: '#ef4444',
      StrokeWidth: 3
    }
  ]
});
```

| 元素类型 | 参数 |
|----------|------|
| `text` | `Text`、`Color`、`FontSize`、`FontFamily`、`FontStyle`、`Align`、`VerticalAlign` |
| `rectangle` / `rect` / `round-rect` | `X`、`Y`、`Width`、`Height`、填充、描边、圆角 |
| `ellipse` / `circle` | `X`、`Y`、`Width`、`Height`、填充、描边 |
| `line` | `X`、`Y`、`X2`、`Y2` 或 `Width`、`Height`、描边 |

所有元素还支持 `Opacity` 和 `Rotation`。单次最多绘制 500 个元素。

### 颜色、安全与资源限制

颜色支持常用英文颜色名、`transparent`、`#RGB`、`#RGBA`、`#RRGGBB`、`#RRGGBBAA`、`rgb(...)`、`rgba(...)`。颜色自身的 Alpha 会与 `Opacity` 相乘。

运行时内置限制：单次最多合并 50 张图；单边不超过 16,384 像素；单张输入或输出画布不超过 25,000,000 像素；单次解码和单次缩放后图层分别不超过 50,000,000 像素；单张输入不超过 25 MB；单次输入总量不超过 100 MB；输出不超过 50 MB。

这些限制是保护上限，不是业务推荐值。匿名接口应增加更严格的数量、尺寸、并发和权限限制。远程图片必须先通过 `V8.Http` 下载，并对用户可控 URL 做协议、域名和目标地址白名单校验，不能把 URL 或服务器路径直接传给 `V8.Image`。

`FontFamily` 是首选字体。运行时会逐个 Unicode 字符验证字形：未传字体、指定字体不存在或某个字体缺少部分字符时，会自动回退到服务器已安装且包含该字形的字体，同一段中英文混排文字可使用多个字体段。如果所有已安装字体都不包含某字符，接口会返回带字符及 `U+XXXX` 码位的明确错误，绝不会生成“口口”缺字方框。文字风格仍依赖操作系统字体，因此 Linux / 精简容器应安装业务所需字体（中文建议 Noto Sans CJK 等），并在要求稳定字形时显式传 `FontFamily`。

## 当前用户 V8.CurrentUser
>* 当前登陆用户信息，包含用户所属角色、组织机构等，包含使用表单引擎对sys_user表新增字段的信息。
>* 未登录时访问到的值为{}
```js
var userName = V8.CurrentUser.Name;
```

## 数据库对象 V8.Db
>* 数据库访问对象，支持Dos.ORM、SqlSugar切换
>* `FromSql` 只传 SQL 字符串；动态值请使用 `.AddInParameter("@p0", value)` 链式绑定，不要写 `FromSql(sql, value)`。
```csharp
//用例：
var list = V8.Db.FromSql("select * from table")//也可以使用V8.DbTrans.FromSql()
                .ToArray(); //返回数组数据，一般用于select查询多条数据语句
                //返回受影响行数，一般用于update、delete、insert语句
                .ExecuteNonQuery(); 
                //返回单条数据，一般用于select查询单条数据语句
                .First(); 
                //返回单条数据的单个字段值，一般用于select单条数据查询、聚合函数、单个字段，如：select sum(Money) from table、select Name from table
                .ToScalar(); 

// 参数化查询
var user = V8.Db.FromSql("select * from sys_user where Id = @p0")
                .AddInParameter("@p0", userId)
                .First();
```

## 数据库只读对象 V8.DbRead
>* 数据库只读对象，用法和V8.Db一样，当数据库未部署读写分离时，此对象与V8.Db对象值一致。

## 扩展数据库对象 V8.Dbs.DbKey
>* 访问多数据库（扩展库）的对象，扩展库管理见：[https://web.microi.net/#/database](https://web.microi.net/#/database)
>* 注意：老的数据库版本上面的表缺少【DbKey】字段，需要更新数据库、或手动添加、或等待应用商城上线【数据库管理】应用安装。
>* 示例：访问oracle扩展库，DbKey的值为OracleDB1，其中V8.Dbs.OracleDB1对象就等同于V8.Db对象。
```js
var dataList = V8.Dbs.OracleDB1.FromSql('').ToArray();

//扩展数据库的事务用法
//【注意】emptyExTrans 是扮展库自己创建的事务，与 V8.DbTrans 完全独立，需要手动管理生命周期
var emptyExTrans = V8.Dbs.EmptyEx.BeginTransaction();
var count = emptyExTrans.FromSql("delete from diy_extend_test where Id='49ec484d-a2cf-47fe-b498-6efb2bf9f99d'").ExecuteNonQuery();
emptyExTrans.Commit();//提交事务
//emptyExTrans.Rollback();//回滚事务
emptyExTrans.Close();//释放事务对象
return { Code : 1, Data : count };
```
>* 已知问题：在平台中添加扩展库后，需要重启api的docker容器才会生效

## 数据库事务 V8.DbTrans
>* 数据库事务对象，可以像V8.Db一样使用，如：
```js
var array = V8.DbTrans.FromSql('...').ToArray();
```
* 无需在接口引擎中手动调用【V8.DbTrans.Rollback()】，平台会自动管理事务的提交与回滚（返回Code=1时自动提交，否则自动回滚）。**事务生命周期由平台统一管理，调用V8.DbTrans.Commit()或Rollback()均无效。**
* 接口引擎示例
```javascript
//操作第一张表，带事务
var result1 = V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
}， V8.DbTrans);
//操作第二张表，带事务
var result2 = V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
}， V8.DbTrans);
//如果第二张表操作成功
if(result2.Code == 1){
  return { Code : 1 };//平台会自动提交事务，因为返回的Code=1
}else{//如果第二张表操作失败
  return { Code : 0, Msg : result.Msg };//平台会自动回滚事务，因为返回的Code=0
}
```

## V8.MongoDb
### 介绍
>* 本篇介绍如何在接口引擎、后端V8事件中对MongoDB进行相关操作
>* 对MongoDB的新增操作会自动生成对应数据库名和表名，因此可自定义分库、分表规则

### 新增数据 AddFormData
>*自定义数据库名、表名，不存在时会自动创建
```javascript
//可以指定固定的Id值
var newId = V8.MongoDb.NewId();
V8.MongoDb.AddFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : newId, //也可以不指定，会自动生成
	_FormData : {
		Name : '张三',
		Sex : '男',
		Age : 18
	}
});
```
### 修改数据 DelFormData
```javascript
V8.MongoDb.UptFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
	_FormData : {
		Name : '张三',
		Sex : '男',
		Age : 18
	}
});
```
### 删除数据 DelFormData
```javascript
V8.MongoDb.DelFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

### 查询数据列表 GetTableData
```javascript
V8.MongoDb.GetTableData({
	DbName : '', //数据库名称，如：sys_log_itdos
	TableName: '', //表名名称，如：log_202412
  _Where : [
    ['Type', '=', '访问菜单'], 
    ['OR', 'Type', '=', '点击V8按钮']
  ]
});
```

### 查询单条数据 GetFormData
```javascript
V8.MongoDb.GetFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

## V8.Http
>* 对RestSharp的封装，注意前端V8的post是V8.Post()，目前暂时并没有封装V8.Http，暂时写法不一致，后期会统一。
::: details 展开查看 JavaScript 代码（45 行）
```javascript
//post请求，返回string，对应的也有V8.Http.Get，参数名称则为GetParam
var loginResult = V8.Http.Post({
  Url : 'http://192.168.0.173:1052/api/SysUser/login', //必传
  PostParam : { Account : 'admin', Pwd : '****', OsClient : 'veken' },
  //注意目前PostParam暂不支持多级属性，如：{ User: { Account : 'admin' }, OsClient : 'veken' }，此时则需要传入序列化后的字符串，如：
  PostParamString : JSON.stringify({ User: { Account : 'admin' }, OsClient : 'veken' }),
  ParamType : 'json', //请求类型，默认form
  Timeout : 5, //请求超时时间，单位秒，默认5秒
  Headers : { token : '', did : ''  }, //请求报文，参数名也可以是Header，平台均支持
  FilesByteBase64 : {}, //上传文件，后期补充用法
  FilesByteString : {}, //上传文件，后期补充用法
});

//post请求，返回Response对象，目前里面暂时只包含Headers、Content。，对应的也有V8.Http.GetResponse，参数数名称则为GetParam
var loginResult2 = V8.Http.PostResponse({
  Url : 'http://192.168.0.173:1052/api/SysUser/login',
  PostParam : { Account : 'admin', Pwd : '******', OsClient : 'veken' }
});
//获取header中的Authorization值
var header = loginResult2.Headers.find(item => {
  return item.Name == 'Authorization' || item.Name == 'authorization';
})
if(header){
  //再获取当前登陆身份信息，测试传入header
  var token = header.Value;
  var getCurrentUser = V8.Http.Post({
    Url: 'http://192.168.0.173:1052/api/SysUser/getCurrentUser',
    Headers: { authorization : 'Bearer ' + token}
  });
  return {
    Code : 0, Msg : '获取身份信息成功：' + getCurrentUser
  };
}else{
  //未获取到token
  return {
    Code : 0,  Msg : '获取header失败：' + loginResult2
  }
}

//发起xml请求
var result = V8.Http.Post({
  Url : 'http://192.168.0.173:1052/api/SysUser/login',
  ParamType : 'xml',
  PostParamString : '<xml><text>1</text></xml>'
});
```
:::

## V8.Header、V8.Param
>* 目前两者均只支持在接口引擎中使用，用于获取客户端http post请求接口引擎地址发送的报文和Request Payload参数。

## 加密类 V8.EncryptHelper
>* Dos.Common加密帮助类
```javascript
var pwd = V8.EncryptHelper.DESEncode('123456');//DES加密
var pwd = V8.EncryptHelper.DESDecode('JdZe5gWKjZo=');//DES解密
var pwd = V8.EncryptHelper.SHA1('123456');
var pwd = V8.EncryptHelper.SHA256('123456');
var pwd = V8.EncryptHelper.SHA512('123456');
var pwd = V8.EncryptHelper.MD5Encrypt('123456');//MD5加密
var pwd = V8.EncryptHelper.Sha256Hex('123456');
```

## V8.Office

### 发送邮件 SendEmail
>* 源码实现在[/Microi.Server/Microi.Office/MicroiOffice.cs](https://gitee.com/ITdos/microi.net/blob/master/Microi.Server/Microi.Office/MicroiOffice.cs)
```js
return V8.Office.SendEmail({
  SmtpServer : 'smtp.qq.com',
  SmtpPort : 587,
  EnableSSL : true,
  SystemEmail : 'admin@itdos.com',
  SystemEmailPwd : 'uuzrnazvv*******',
  EmailSubject : '测试接口引擎发邮件标题',
  EmailBody : '<b>测试接口引擎发邮件内容，<span style="color:red;">支持html</span></b>',
  Receivers : ['123446172@qq.com', '973702@qq.com']
});
```

## 系统设置 V8.SysConfig
>* 访问系统设置信息，可以访问到系统设置`sys_config`表的任意字段
```js
var sysTitle = V8.SysConfig.SysTitle;
```

## SaaS引擎信息 V8.OsClientModel
>* 访问当前SaaS引擎敏感配置数据
>* 第三方系统敏感配置也均应该放到SaaS引擎的配置中，如第三方系统key、secret等
```js
//获取redis host
var redisHost = V8.OsClientModel.RedisHost;
```

## 表单数据 V8.Form
>* 表单提交事件中可访问表单数据，接口引擎中此对象为空。

## V8.OldForm
>* 在修改数据时，后端V8事件可访问到V8.OldForm修改前的数据值

## V8.FormSubmitAction
>* 表单提交类型：可能的值：`Insert` `Delete` `Update`（string类型）
>* 注意服务器端V8事件里面没有`FormOutAction`、`FormOutAfterAction`，只有`FormSubmitAction`

## V8.EventName
>* 后端V8事件名称，在全局V8引擎代码中比较好用，可能的值：
```js
FormSubmitBefore：表单提交前V8事件
FormSubmitAfter：表单提交后V8事件
DataFilter：数据处理V8事件
WFNodeLine：流程节点条件判断V8事件
WFNodeEnd：流程节点结束V8事件
WFNodeStart：流程节点开始V8事件
```


## V8.Param
>* 用于访问前端传入的参数，能访问到url参数、form-data参数、payload-json参数

## V8.Action
>* 用于访问在全局服务器V8代码处自定义的方法

## V8.InvokeType
>* 访问当前调用类型，可能的值：`Server`、`Client`，当访问到的V8.InvokeType为空时，则默认`Server`
>* `Server`：服务器端调用，如在接口引擎中调用接口引擎，在后端V8事件中调用接口引擎
>* `Client`：前端调用，如在前端V8事件中调用接口引擎，在前端提交表单

## V8.TableModel
>* 在后端V8事件中，可访问到操作的当前`diy_table`表的信息

## V8.OsClient
>* 访问当前的OsClient值

## console
>* Microi.net.dll从v3.5.1开始支持console往服务器端输出日志
```js
console.log('日志输出');
console.error('日志输出');
console.warn('日志输出');
console.info('日志输出');
//服务端查看日志
docker logs microi-api
```
