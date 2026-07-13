# 🖥️ V8 Function List-Backend

> **Server-side V8 engine supports ES6 syntax and integrates backend objects and methods**

---

## 📌Introduction

- Server-side V8 engine code and front-end V8 programming language are JavaScript syntax
- Server-side V8 engine supports ES6 syntax
- Integrates back-end objects and methods, and can use JS to call back-end methods (non-HTTP)
- Server-side V8 code is executed on the server side
- Server-side V8 events, interface engines, data source engines, etc., mainly for form properties

## Interface Engine V8.ApiEngine
> * [Interface Engine Details](https://microi.net/doc/v8-engine/api-engine)
> * Server-side V8 events can directly call the interface engine (non-http), and the interface engine can also call the interface engine
> * V8 event or interface engine can pass in the event object when calling another interface engine, which can guarantee that the same transaction
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

## Forms Engine V8.FormEngine
> * See platform documentation:[FormEngine usage](https://microi.net/doc/v8-engine/form-engine.html)

## Cache Operations V8.Cache
* Distributed cache operation class, usage V8.Cache('Key', 'Value', '0.00:10:00 ');
> * Note: The format of the expiration time must be`d.HH:mm:ss`, such as`0.12:00:00`0 days, 12 hours,`1.10:10:00`If the expiration time parameter is not passed for 10 hours and 10 minutes a day, it is permanent.
> * The recommended naming rule for the cache key is:`Microi:${V8.OsClient}:{分类key值}:{Key}`, which is consistent with the platform's cache Key naming rules, is easy to view, and distinguishes SaaS tenants to prevent cache confusion.
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
* Verification code cache Key naming rules:
```
`Microi:${OsClient值}:{分类key值}:{Key}`
示例：
`Microi:iTdos:Captcha:aaaa-bbbb-cccc`
```
* The redis key prefix of the platform always has only 4 levels:
> * the first level is used to distinguish which redis folder is used by my code platform when other third-party systems share the same redis instance.
> * The second level is used to distinguish saas tenants
> * the third level is used to distinguish redis classification, such as verification code
> * the fourth level is the key to be used in the end

## C# System Class System
> * server-side V8 code can directly use the System namespace under. net
::: details Expand to see the C# code (line 39)
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

## Common functions V8.Method
> * Integrates some common functions, can be customized extension
::: details Expand to view JavaScript code (26 lines)
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
> * Base64 conversion. Unlike System.Convert.ToBase64String(bytes), V8.Base64 directly returns the source string if an exception occurs.
```javascript
var result = V8.Base64.StringToBase64('123456');
var result = V8.Base64.Base64ToString('MTIzNDU2');
```

## Image processing V8.Image

`V8.Image` provides cross-platform server-side image generation, composition, and editing. Every method accepts an options object and only processes in-memory Base64, data URIs, or byte arrays. It does not read local paths or fetch URLs by itself.

### Image sources and results

The following source forms are supported:

```javascript
// Top-level Base64
{ FileByteBase64: '<base64>' }

// Equivalent source fields
{ Base64: '<base64>' }
{ DataUrl: 'data:image/png;base64,...' }
{ Bytes: response.RawBytes }

// Single-image methods also accept nested Image / Source values as objects or strings
{ Image: { FileByteBase64: '<base64>' } }
{ Source: '<base64>' }
```

Except for `GetInfo`, a successful operation returns a standard `DosResult`:

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

Always check `Code` before reading `Data`. If the API Engine has Response File enabled, return this result directly to preview or download the image in a browser.

Common output options:

| Option | Default | Description |
|--------|---------|-------------|
| `OutputFormat` / `Format` | `png` | Supports `png`, `jpeg` / `jpg`, `webp`, and `bmp`; `OutputFormat` takes precedence |
| `Quality` | `90` | Encoding quality, clamped to 1 through 100 |
| `BackgroundColor` | Transparent; white for JPEG | Canvas background color |
| `FileName` | `image.<extension>` | Output file name; its extension is corrected to the actual format |

Common compatibility aliases are `ImageFormat` / `OutputType` → `OutputFormat`, `Background` / `BgColor` → `BackgroundColor`, and `ImageBase64` → `FileByteBase64` for single-image methods.

### Methods

| Method | Description |
|--------|-------------|
| `V8.Image.Create(param)` | Create a solid, gradient, text, or basic-shape image |
| `V8.Image.Merge(param)` | Compose images horizontally, vertically, in a grid, or as layers |
| `V8.Image.Overlay(param)` | Overlay shortcut; defaults to `overlay` when no mode is supplied |
| `V8.Image.Resize(param)` | Resize an image |
| `V8.Image.Crop(param)` | Crop a rectangular region |
| `V8.Image.Rotate(param)` | Rotate an image |
| `V8.Image.Flip(param)` | Flip horizontally or vertically |
| `V8.Image.Convert(param)` | Convert the encoded image format |
| `V8.Image.Draw(param)` | Draw text and shapes on an existing image |
| `V8.Image.Watermark(param)` | Add an image watermark |
| `V8.Image.CreateQRCode(param)` | Create a QR code |
| `V8.Image.GetInfo(param)` | Read dimensions, format, frames, and other metadata |

Options specific to `Create`:

| Option | Default | Description |
|--------|---------|-------------|
| `Width` / `Height` | `800` / `600` | New canvas dimensions |
| `CanvasWidth` / `CanvasHeight` | Not set | Override `Width` / `Height`, respectively |
| `BackgroundColorEnd` | Not set | Enables a linear gradient from `BackgroundColor` |
| `GradientDirection` | `left-to-right` | Horizontal, `top-to-bottom` / `vertical`, or `diagonal` |
| `Text` / `TextColor` / `FontSize` / `FontFamily` | Not set / `#111827` / `32` / default font | Append shortcut text at the center of the canvas |
| `Elements` | Not set | Text, rectangle, ellipse, circle, and line elements |

### Create images and overlay layers

The following example creates a large image and a small badge, then places the badge at explicit coordinates. Overlay mode draws from the lowest to the highest `ZIndex`, so a larger value appears on top. For equal values, a later array item appears on top.

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

A two-image shorthand is also available:

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

Base-image aliases are `BaseImage`, `BackgroundImage`, `FirstImage`, and `Base`. Overlay-image aliases are `OverlayImage`, `ForegroundImage`, `SecondImage`, and `Overlay`. Top-level `X`, `Y`, `Position`, `Opacity`, `OverlayWidth`, `OverlayHeight`, and `Scale` apply to the overlay image in this shorthand.

### Merge modes

```javascript
// Horizontal composition
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

// Vertical composition
var vertical = V8.Image.Merge({
  Mode: 'vertical',
  Direction: 'ttb',
  Gap: 16,
  Alignment: 'left',
  Images: [firstBase64, secondBase64]
});

// Grid composition
var grid = V8.Image.Merge({
  Mode: 'grid',
  Columns: 3,
  Gap: 12,
  Padding: 12,
  Images: imageBase64List
});
```

| Option | Description |
|--------|-------------|
| `Mode` | `horizontal`, `vertical`, `grid`, or `overlay` |
| `Layout` | Takes precedence over `Mode`; accepts `row`, `column`, `canvas`, `cover`, and the directional shortcuts `left/right/top/bottom/up/down` |
| `Direction` | `ltr`, `rtl`, `ttb`, or `btt`; full forms such as `left-to-right` are also accepted |
| `Images` / `Layers` | Image or layer array; an item may be a raw Base64 or data URI string |
| `CanvasWidth` / `CanvasHeight` | Fixed canvas dimensions; otherwise calculated from the layout |
| `Padding` / `Gap` | Canvas padding / space between images; negative values become zero |
| `Alignment` | Cross-axis alignment for rows and columns, or alignment inside a grid cell |
| `Columns` | Number of grid columns |

Merge aliases are `MergeType` / `Type` → `Mode` and `Items` → `Images`.

### Layer options

| Option | Default | Description |
|--------|---------|-------------|
| `Width` / `Height` | Source dimensions | When only one is set, the other is calculated proportionally |
| `Scale` | `1` | Additional proportional scaling after width/height calculation; greater than 0 and no more than 100 |
| `Fit` | `contain` | With both dimensions set: `contain`, `cover`, `fill` / `stretch`, or `none` |
| `X` / `Y` | Not set | Absolute overlay coordinates; if either is set, the other defaults to `Padding` |
| `Position` / `Anchor` | `top-left` | Anchor used when coordinates are absent; `Position` takes precedence |
| `OffsetX` / `OffsetY` | `0` | Offset added after coordinate or anchor positioning |
| `Opacity` | `1` | Opacity, clamped to 0 through 1 |
| `Rotation` | `0` | Clockwise rotation in degrees |
| `ZIndex` | `0` | Overlay order; a larger value appears on top |
| `FlipHorizontal` / `FlipVertical` | `false` | Flip this layer |
| `CropX` / `CropY` / `CropWidth` / `CropHeight` | Entire source | Crop the source before resizing |
| `CornerRadius` | `0` | Corner radius |
| `BorderColor` / `BorderWidth` | Not set / `0` | Layer border |
| `BlendMode` | `src-over` | Layer blend mode |

`contain` preserves the complete image while scaling proportionally; `cover` center-crops to fill the requested dimensions; `fill` / `stretch` forces the requested dimensions; `none` keeps the source size. `Scale` is applied after this calculation.

Common anchors are `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, and `bottom-right`. Blend modes are `src-over`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `plus` / `add`, `src`, and `dst-over`.

Layer aliases are `Order` → `ZIndex`, `Alpha` → `Opacity`, `Rotate` → `Rotation`, and `Left` / `Top` → `X` / `Y`.

### Other image operations

```javascript
// Resize: set at least Width or Height; Pad=true retains the full requested canvas
var resized = V8.Image.Resize({
  Image: sourceBase64,
  Width: 800,
  Height: 600,
  Fit: 'cover',
  Pad: false,
  AllowUpscale: true,
  Alignment: 'center'
});

// Crop; Clamp=true shrinks a partly out-of-bounds rectangle to the image
var cropped = V8.Image.Crop({
  Image: sourceBase64,
  X: 100,
  Y: 80,
  Width: 640,
  Height: 360,
  Clamp: false
});

// Rotate; Expand=false keeps the original canvas and may clip edges
var rotated = V8.Image.Rotate({
  Image: sourceBase64,
  Degrees: 30,
  Expand: true
});

// Horizontal / vertical flip; Horizontal defaults to true, Vertical to false
var flipped = V8.Image.Flip({
  Image: sourceBase64,
  Horizontal: true,
  Vertical: false
});

// Format conversion
var converted = V8.Image.Convert({
  Image: sourceBase64,
  OutputFormat: 'webp',
  Quality: 85,
  FileName: 'converted.webp'
});

// Image watermark
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

// QR code; Content takes precedence over Text, and Size defaults to 300
var qr = V8.Image.CreateQRCode({
  Content: 'https://microi.net/',
  Size: 420,
  FileName: 'qrcode.png'
});

// Read source image information
var info = V8.Image.GetInfo({ Image: sourceBase64 });
// Data: Width, Height, Format, ContentType, Size, FrameCount,
// RepetitionCount, Origin, HasAlpha
```

For `Watermark`, `Image` may be used instead of `BaseImage`. It also accepts `Base` → `BaseImage` and `Overlay` → `Watermark`.

### Draw text and shapes

`Create` and `Draw` use the same `Elements` structure. `Create` draws on a new canvas; `Draw` draws over the input image and preserves its dimensions.

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

| Element type | Parameters |
|--------------|------------|
| `text` | `Text`, `Color`, `FontSize`, `FontFamily`, `FontStyle`, `Align`, `VerticalAlign` |
| `rectangle` / `rect` / `round-rect` | `X`, `Y`, `Width`, `Height`, fill, stroke, and corner radius |
| `ellipse` / `circle` | `X`, `Y`, `Width`, `Height`, fill, and stroke |
| `line` | `X`, `Y`, `X2`, `Y2` or `Width`, `Height`, plus stroke options |

Every element also accepts `Opacity` and `Rotation`. At most 500 elements may be drawn in one call.

### Colors, security, and resource limits

Colors accept common English color names, `transparent`, `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb(...)`, and `rgba(...)`. A color's own alpha is multiplied by `Opacity`.

Built-in limits are: at most 50 images per merge; no dimension above 16,384 pixels; no single input or output canvas above 25,000,000 pixels; no more than 50,000,000 decoded pixels and 50,000,000 post-resize layer pixels per call; at most 25 MB per source image; at most 100 MB total input; and at most 50 MB output.

These are protective ceilings, not recommended business limits. Anonymous APIs should enforce stricter count, dimension, concurrency, and permission limits. Fetch remote images with `V8.Http` first and validate user-controlled URLs against protocol, host, and destination-address allowlists. Never pass a URL or server path directly to `V8.Image`.

`FontFamily` is a preferred family. The runtime validates every Unicode character and automatically falls back to an installed font when no family is specified, the requested family does not exist, or it lacks part of the text. Mixed-script text may therefore use multiple font runs. If no installed font contains a character, the API returns a clear error containing that character and its `U+XXXX` code point instead of rendering missing-glyph boxes. Text appearance still depends on operating-system fonts, so install the required business fonts in Linux or minimal containers (for example, Noto Sans CJK for Chinese) and pass `FontFamily` when typography must remain stable.

## Current User V8.CurrentUser
> * The information of the current login user, including the role and organization of the user, and the information of the fields added to the sys_user table by using the form engine.
> * The value accessed when not logged in is {}
```js
var userName = V8.CurrentUser.Name;
```

## Database Objects V8.Db
> * Database access object, support Dos.ORM, SqlSugar switching
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
```

## Database read-only objects V8.DbRead
> * Database read-only object. The usage is the same as that of V8.Db. When read/write splitting is not deployed in the database, the value of this object is consistent with that of the V8.Db object.

## Extend database object V8.Dbs.DbKey
>* Access objects in multiple databases (extension libraries). For extension library management, see: [https://web.microi.net/#/database](https://web.microi.net/#/database)
>* Note: Tables in older database versions are missing the [DbKey] field. You need to update the database, add the field manually, or wait for the App Store to launch the [Database Management] app and install it.
>* Example: To access the Oracle extension library, set the DbKey value to OracleDB1. In this case, the V8.Dbs.OracleDB1 object is equivalent to the V8.Db object.
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
>* Known Issue: After adding an extension library to the platform, you must restart the API’s Docker container for the changes to take effect.

## Database Transactions V8.DbTrans
> * Database transaction objects, which can be used like V8.Db, such:
```js
var array = V8.DbTrans.FromSql('...').ToArray();
```
* There is no need to manually call [V8.DbTrans.Rollback()] in the interface engine. The platform will automatically manage the commit and rollback of transactions (automatically commit when Code = 1 is returned, otherwise it will automatically roll back). **The transaction lifecycle is managed by the platform. Calling V8.DbTrans.Commit() or Rollback() is invalid.**
* Interface Engine Example
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
### Introduction
> * This article describes how to perform related operations on MongoDB in the interface engine and backend V8 events
> * the new operation on the MongoDB will automatically generate the corresponding database name and table name, so you can customize the rules for dividing the database and table.

### Add Data AddFormData
> * custom database name, table name, automatically created if it does not exist
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
### Modify Data DelFormData
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
### Delete Data DelFormData
```javascript
V8.MongoDb.DelFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

### Query data list GetTableData
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

### query a single data GetFormData
```javascript
V8.MongoDb.GetFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

## V8.Http
> * for RestSharp encapsulation, note that the post of the front end V8 is V8.Post(). at present, V8.Http is not encapsulated for the time being. the writing method is inconsistent for the time being and will be unified later.
::: details Expand to view JavaScript code (45 lines)
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

## V8.Header, V8.Param
> * currently, both of them can only be used in the interface engine to obtain the message sent by the client http post request interface engine address and Request Payload parameters.

## Encryption class V8.EncryptHelper
> * Dos.Common Encryption Help Class
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

### Send Mail SendEmail
> * Source implementation in [/Microi.Server/Microi.Office/MicroiOffice.cs](https://gitee.com/ITdos/microi.net/blob/master/Microi.Server/Microi.Office/MicroiOffice.cs)
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

## System Settings V8.SysConfig
> * Access to system settings information, you can access to system settings`sys_config`Any field of the table
```js
var sysTitle = V8.SysConfig.SysTitle;
```

## SaaS Engine Information V8.OsClientModel
> * Access sensitive configuration data of the current SaaS engine
> * sensitive configurations of third-party systems should also be put into the configuration of SaaS engine, such as key and secret of third-party systems.
```js
//获取redis host
var redisHost = V8.OsClientModel.RedisHost;
```

## Form Data V8.Form
> * The form data can be accessed in the form submission event, and this object is empty in the interface engine.

## V8.OldForm
> * When modifying data, the backend V8 event can access the data value before V8.OldForm modification

## V8.FormSubmitAction
* Form submission type: Possible values:`Insert` `Delete` `Update`(string type)
> * Note that there is no server-side V8 event`FormOutAction`、`FormOutAfterAction`, only`FormSubmitAction`

## V8.EventName
> * The name of the backend V8 event. It is relatively easy to use in the global V8 engine code. Possible values:
```js
FormSubmitBefore：表单提交前V8事件
FormSubmitAfter：表单提交后V8事件
DataFilter：数据处理V8事件
WFNodeLine：流程节点条件判断V8事件
WFNodeEnd：流程节点结束V8事件
WFNodeStart：流程节点开始V8事件
```


## V8.Parameter
> * Used to access the parameters passed in by the front end, url parameters, form-data parameters, and payload-json parameters can be accessed.

## V8.Action
* Used to access methods customized at the global server V8 code

## V8.InvokeType
> * Access to the current call type, possible values:`Server`、`Client`When the accessed V8.InvokeType is empty, the default`Server`
>*`Server`: Server-side calls, such as calling the interface engine in the interface engine and calling the interface engine in the back-end V8 event
>*`Client`: Front-end calls, such as calling the interface engine in the front-end V8 event and submitting the form in the front-end

## V8.TableModel
> * In the backend V8 event, you can access the current operation`diy_table`Table Information

## V8.OsClient
> * Access the current OsClient value

## console
> * Microi.net.dll supports console to output logs to the server since v3.5.1
```js
console.log('日志输出');
console.error('日志输出');
console.warn('日志输出');
console.info('日志输出');
//服务端查看日志
docker logs microi-api
```
