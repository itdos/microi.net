# v8-file-upload 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-file-upload-008 sha256=73506d076e7917db846f615cd9c0d899bb8b58a3917f375bce9eff6ea903e8a0 -->
## Office 文件在线编辑版本号规则

当文件上传控件开启【Office 在线预览】、【允许在线编辑】和【开启 Office 文件版本号】时，前后端必须遵循统一版本规则：

- 新上传的 Office 文件（`pdf/doc/docx/xls/xlsx/ppt/pptx`）要立即写入初始版本 `v1.0.0`，字段 JSON 的 `Path` 指向该原始文件，`Version` 为 `v1.0.0`，`Versions[0]` 保存同一份原始文件路径。
- 用户进入 OnlyOffice 在线编辑页后，每次手动点击【保存文件】才生成新版本；第一次保存生成 `v1.0.1`，之后依次生成 `v1.0.2`、`v1.0.3`。
- 未开启版本号时，保存文件直接覆盖当前 `Path` 对应的 HDFS/OSS 源文件。
- 开启版本号时，保存文件必须生成带版本号后缀的新文件，例如 `contract_v1.0.1.docx`，字段 JSON 的 `Path` 指向最新版本，`Versions` 保留历史版本路径。
- 在线 Office 路由和文件上传字段都要能读取 `Versions`，用于右上角切换历史版本预览/编辑。

### OnlyOffice 服务端取文件与匿名预览规则

- OnlyOffice 文档服务器会在服务端再次下载文件。浏览器可以下载但 OnlyOffice 提示“下载失败”时，优先检查生成地址是否为 `localhost/127.0.0.1/内网域名`。
- OnlyOffice 可能先对文档地址发起 `HEAD` 探测。响应文件接口除了 `GET 200`，还必须让 `HEAD` 返回相同的 `Content-Type/Content-Length/Content-Disposition`，不能返回 `405`。
- 私有文件在线预览调用 `GetPrivateFileUrl` 或 `/api/HDFS/GetPrivateFileUrl` 时传 `ForOfficePreview:true`。审计代理应优先使用租户系统配置的公网 `ApiBase`，但仍把真实对象存储签名地址保存在共享 Redis ticket 中，禁止直接返回真实签名地址。
- `/online-office` 可以匿名访问。公有存储模式只允许当前 `OsClient` 目录下的 `filePathName`；接口模式通过 `fileUrl` 接收当前平台正式 `ApiBase`，或由同端口本地后端读取的 loopback `/apiengine/...` 响应文件地址，并要求 URL 显式携带当前 `OsClient`。两种模式都拒绝跨租户、路径穿越和任意第三方 URL；`isPrivate=1` 必须登录。
- 匿名接口引擎预览不要求 V8 代码先上传 HDFS：接口开启【响应文件】和【允许匿名】后，完整地址 URL 编码传给 `fileUrl`，同时传 `fileName/fileType`。页面通过匿名安全中转让当前后端限域读取源文件，并以确定性路径缓存到当前租户公有对象存储；OnlyOffice 只接收公网 `FileServer` 地址。loopback 仅允许同端口本地后端访问，禁止开放任意 URL 代理。
- `canEdit` 只是前端请求参数，不是权限。最终编辑条件必须是“有效登录态 && canEdit=true”；匿名始终只读，不能因 URL 参数放开编辑。
- 匿名预览页隐藏左侧菜单、顶部导航和页签；已登录用户保持原系统布局。
- 匿名导出响应接口应配置频率限制或保证生成逻辑足够轻量，不能让单个公网 URL 无界消耗 CPU/内存；如业务仍需要落盘缓存，缓存事实必须进入共享 Redis/HDFS，不能用进程内变量。

字段 JSON 示例：

```json
{
  "Name": "contract.docx",
  "Path": "/tenant_demo/file/20260622/contract_v1.0.1.docx",
  "Version": "v1.0.1",
  "Versions": [
    { "Version": "v1.0.0", "Name": "contract.docx", "Path": "/tenant_demo/file/20260622/contract.docx", "IsLatest": false },
    { "Version": "v1.0.1", "Name": "contract_v1.0.1.docx", "Path": "/tenant_demo/file/20260622/contract_v1.0.1.docx", "IsLatest": true }
  ]
}
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-009 sha256=50fba71370f45de3dd677f5731f3956c328a8d3b1ca2125b853128067f9af40a -->
## ImgUpload / FileUpload 字段值兼容规则

`ImgUpload` 不能假设只是一种值结构。PC 表单、移动端、旧数据、单图/多图、公开/私有桶会混合出现以下格式：

| 场景 | 可能的值 |
|------|----------|
| 空值/占位 | `''`、`null`、`undefined`、`'[]'`、`'null'`、`'正在上传中...'` |
| 旧单图 | `'/upload/xxx/a.png'`、`'https://cdn/a.png'` |
| 新单图 | `{ Path, Name, Size, Id, State }` 或 JSON 字符串 `'{"Path":"..."}'` |
| 多图 | `[{ Path, Name, Id, State }]` 或 JSON 字符串 `'[{"Path":"..."}]'` |
| 其它兼容字段 | `Path`、`FilePathName`、`FullPath`、`Url`、`url`、`src` |

任何端（PC、uni-app、H5、小程序）渲染图片前都必须先做“归一化 -> 取 Path -> 转最终 URL”，不要直接 `JSON.parse` 后只处理数组，也不要直接把字段值拼到 `FileServer`。

推荐归一化：

```javascript
function normalizeUploadValue(value) {
  if (value == null || value === '' || value === 'undefined' || value === 'null') return [];
  if (value === '正在上传中...' || value === '[]' || value === '[ ]') return [];

  var raw = value;
  if (typeof raw === 'string') {
    var s = raw.trim();
    if ((s.indexOf('{') === 0 || s.indexOf('[') === 0)) {
      try { raw = JSON.parse(s); } catch (e) { raw = s; }
    } else {
      raw = s;
    }
  }

  if (Array.isArray(raw)) {
    return raw.map(normalizeUploadItem).filter(function (it) { return !!it.Path; });
  }

  var one = normalizeUploadItem(raw);
  return one.Path ? [one] : [];
}

function normalizeUploadItem(item) {
  if (!item) return {};
  if (typeof item === 'string') {
    return { Path: item, Name: item.split('/').pop() || item, State: 1 };
  }
  if (typeof item === 'object') {
    var path = item.Path || item.FilePathName || item.FullPath || item.Url || item.url || item.src || '';
    return {
      Id: item.Id || item.id || '',
      Name: item.Name || item.FileName || item.name || (path ? String(path).split('/').pop() : ''),
      Size: item.Size || item.size || '',
      CreateTime: item.CreateTime || item.createTime || '',
      State: item.State == null ? 1 : item.State,
      Path: path
    };
  }
  return {};
}
```

公开图片 URL 解析原则与 `Microi.Client/src/utils/diy.common.js` 的 `GetServerPath` 一致：

```javascript
function publicUploadUrl(path) {
  if (!path) return '';
  var s = String(path).trim();
  if (!s || s === '正在上传中...') return '';
  if (s.indexOf('.') === 0) return s;              // ./static/img/loading.gif 等本地静态资源
  if (/^(https?:|data:|blob:)/i.test(s)) return s; // 已经是最终 URL
  if (s.indexOf('{') === 0 || s.indexOf('[') === 0) {
    var list = normalizeUploadValue(s);
    s = list.length ? list[0].Path : '';
  }
  if (!s) return '';
  return String(V8.SysConfig.FileServer || '').replace(/\/+$/, '') + '/' + s.replace(/^\/+/, '');
}
```

私有桶（`Limit === true`）不要拼 `FileServer`，必须把归一化后的 `Path` 传给 `V8.Method.GetPrivateFileUrl({ FilePathName: path })` 或后端签名接口换临时 URL。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-010 sha256=f34d476435c3a8321df017b481771d757f580c8d75f7648fdd54ee1c624d116c -->
## 安全注意

- ❌ 不要让前端任意指定 `Path`（路径穿越风险），只允许后端固定路径
- ❌ 不要不校验文件类型 / 大小：根据 ContentType + 后缀双重校验
- ❌ 不要把持有 Token 当成私有文件授权；普通用户必须证明菜单、记录和字段引用关系
- ❌ 不要向普通角色开放文件列表、移动、重命名、删除、覆盖等管理接口；这些接口仅限 `Level >= 9999`
- ❌ 不要开启 UEditor `catchimage` 远程抓图；默认关闭，确需采集时另建带域名白名单、DNS/IP 校验、禁止跳转、超时和响应上限的受控接口
- ❌ 敏感文件（合同、身份证）必须用私有桶 `Limit: true`
- ✅ 公有桶 URL 可缓存到前端，私有桶临时 URL 每次重新生成
- ✅ 删除数据时同步清理 HDFS 文件（避免存储泄漏）
- ✅ Excel/PDF 等导出文件通过【响应文件】配置返回，不要拼接到 JSON 数据里

### 安全升级兼容

- 旧页面如果只传 `FilePathName` 获取私有地址，升级后普通帐号会失败；必须补齐 `FormEngineKey`、`FormDataId`、`FieldId`、`SysMenuId`，不能改回匿名或放开管理权限。
- 旧自定义上传若依赖普通用户设置 `Limit:false` 或任意多级 `Path`，应改成私有上传；公开资源改走受控发布流程。
- 历史公有文件不会自动变成私有文件。迁移时先复制对象、验证私有读取，再停止旧公有访问；数据库继续保存租户内相对路径，不能持久化临时 URL。
- 上线验收至少覆盖：普通角色跨菜单/跨记录/跨字段读取被拒绝、单文件/单请求/数量限制、帐号与租户配额、Redis 故障失败关闭、多节点并发、公有匿名 `200`、私有匿名 `403`、授权私有访问 `200`。

### 复盘：ZIP 发布端与安装端 SHA256 口径不一致

- 触发场景：应用包已成功生成 ZIP 和摘要，但安装端下载 ZIP 后调用不存在的哈希辅助函数，或尝试通过当前 V8 环境不可用的 `.NET SHA256.Create()` 校验，导致安装中断。
- 根因：发布端实际使用 `V8.EncryptHelper.Sha256Hex(FileByteBase64)`，安装端却按原始字节设计了另一套实现，函数名称、输入数据和运行时能力均未对齐。
- 通用规则：文件摘要必须在包清单中记录算法和输入口径；当前应用 ZIP 统一使用 `SHA256-Base64Text`，发布端与安装端都对同一份 Base64 文本调用 `V8.EncryptHelper.Sha256Hex`。禁止仅凭函数名推测算法，也不要在未验证 V8 互操作能力时直接实例化 `.NET` 加密对象。
- 自动化检查：生成同时包含源码 ZIP、编译 ZIP 的应用包，再从官方地址下载并安装；分别篡改 Base64 文本和摘要，正常包应安装成功，两个篡改包都必须在解压前被拒绝。
<!-- /microi-progressive:chunk -->
