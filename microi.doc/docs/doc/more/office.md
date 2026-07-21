# 📑 Office 在线编辑

> 平台集成 **OnlyOffice** 免费社区版作为文档编辑、预览服务，支持 Word、Excel、PPT 在线编辑。

---

## 🐳 通过 Docker 编排部署 OnlyOffice

::: tip 💡 提示
如遇 `onlyoffice/documentserver` 拉取超时，可使用吾码公开镜像：`registry.cn-hangzhou.aliyuncs.com/microios/onlyoffice-documentserver:202509`
:::
::: details 展开查看 JSON 配置（22 行）
```json
version: '3.8'
services:
  microi-onlyoffice:
    image: onlyoffice/documentserver
    container_name: microi-onlyoffice
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1020:80"
    environment:
      - JWT_ENABLED=false
    volumes:
      - /microi/onlyoffice/DocumentServer/logs:/var/log/onlyoffice
      - /microi/onlyoffice/DocumentServer/data:/var/www/onlyoffice/Data
      - /microi/onlyoffice/DocumentServer/lib:/var/lib/onlyoffice
      - /microi/onlyoffice/DocumentServer/db:/var/lib/postgresql
```
:::

---

## ⚙️ 设置反向代理与平台配置

1. 假设反向代理地址为：`https://net.itdos.net:1021`
2. 在平台 **系统设置** 中设置 **`OnlyOfficeApiBase`** 字段值为 `https://net.itdos.net:1021`（若无此字段则先创建）

::: tip 💡 效果
配置完成后，平台中所有 PPT、Excel、Word 格式的附件将默认通过 OnlyOffice 在线打开。
:::

## 🔗 文件下载正常，但 OnlyOffice 提示“下载失败”

浏览器能下载文件，不代表 OnlyOffice 文档服务器也能访问同一个地址。OnlyOffice 会在服务器端再次请求文件；如果平台生成的文档地址是 `localhost`、`127.0.0.1` 或仅内网可达地址，浏览器下载可能正常，但远程文档服务器会提示“下载失败”。

请同时确认：

1. 生产环境的 `ApiBase` 应配置为平台真实 API 地址；接口引擎响应文件通过 `/online-office?fileUrl=...` 预览时，本地 `localhost` 地址会由平台后端安全读取并缓存到公网 `FileServer`，不会直接交给远程 OnlyOffice。
2. 系统设置的 `FileServer` 是可访问的公有文件域名。
3. 私有文件仍由 `/api/HDFS/OpenPrivateFile` 审计代理提供临时地址，不应把对象存储真实签名地址直接暴露给 OnlyOffice。
4. 在线预览获取私有文件地址时传 `ForOfficePreview:true`；平台会优先用系统设置的公网 `ApiBase` 生成审计代理地址。
5. 文件地址的 `HEAD` 探测也返回 `200` 和正确的 `Content-Type/Content-Length`；OnlyOffice 可能先用 `HEAD` 检查文件，只有 `GET` 可下载而 `HEAD=405` 仍会导致预览一直加载。

```js
var result = V8.Method.GetPrivateFileUrl({
  OsClient: V8.OsClient,
  FilePathName: '/itdos/file/20260721/example.xlsx',
  Limit: true,
  ForOfficePreview: true
});
```

## 🌐 匿名只读在线预览公有文件或接口引擎响应文件

`/online-office` 支持不登录访问，但匿名访问有固定安全边界：

- 公有存储模式只允许当前 `OsClient` 目录下的 `filePathName`；私有文件必须登录。
- 接口模式只允许当前平台正式 `ApiBase`，或由同端口本地后端读取的 loopback `/apiengine/...` 响应文件地址，并且 URL 必须显式携带当前 `OsClient`；不接受任意第三方 URL。
- 匿名访问始终为只读，即使 URL 传 `canEdit=1` 也不会获得编辑权限。
- 匿名页面自动隐藏左侧系统菜单、顶部导航和页签；登录用户按原有系统布局打开。
- 不要把合同、身份证、工资单等敏感文件上传到公有桶后通过匿名链接发送。

公有文件示例：

```text
http://localhost:1988/?OsClient=iTdos#/online-office?fileName=example.xlsx&filePathName=%2Fitdos%2Foffice-demo%2Fexample.xlsx&isPrivate=0&canEdit=0
```

接口引擎响应文件示例：

```text
http://localhost:1988/?OsClient=iTdos#/online-office?fileUrl=https%3A%2F%2Flocalhost%3A7266%2Fapiengine%2Fexport-excel-advanced-demo-preview--OsClient--iTdos--&fileName=%E5%90%BE%E7%A0%81V8%E9%AB%98%E7%BA%A7Excel%E5%A4%9ASheet%E7%A4%BA%E4%BE%8B.xlsx&fileType=xlsx&canEdit=0
```

`fileUrl` 必须整体执行 URL 编码。页面先调用匿名安全中转接口，由当前平台后端读取该接口引擎的文件响应，再按 URL 和文件名的 SHA-256 写入当前租户 `office-preview` 公有对象目录（Redis 共享缓存 10 分钟）；OnlyOffice 最终读取公网 `FileServer` 静态地址。因此开发环境可以直接传同端口 `localhost/127.0.0.1` 接口地址，不要求远程 OnlyOffice 能访问开发机。中转不是通用代理：只允许当前平台、当前 `OsClient` 的单层 `/apiengine/{key}`，不跟随重定向，并限制 50MB 和 Office/PDF/CSV 文件头。

主要参数：

| 参数 | 说明 |
|---|---|
| `fileName` | 带扩展名的文件名，OnlyOffice 据此识别 Word/Excel/PPT 类型 |
| `fileUrl` | 匿名响应文件接口地址；仅允许当前平台 `/apiengine/...`，必须显式包含当前 `OsClient` |
| `fileType` | 当 `fileUrl` 路径没有扩展名时指定 `xlsx/docx/pptx/pdf`；Excel 接口未传时默认 `xlsx` |
| `filePathName` | 当前租户公有存储相对路径；匿名访问不能传其它租户路径或任意外部 URL |
| `isPrivate` | `0` 为公有文件；`1` 必须登录后获取临时审计代理地址 |
| `canEdit` | 是否申请编辑；只有登录态有效，匿名场景强制为 `0` |
| `hdfs` | 文件存储类型，如 `Aliyun` |

## 🧪 高级 Excel 下载与在线预览示例

官方接口引擎提供两个匿名文件响应地址：

- `export-excel-advanced-demo`：直接下载 5 Sheet `.xlsx`，包含截图同款申请单、主子表分组、复杂合并表头、标准表格和边框样式库。
- `export-excel-advanced-demo-preview`：同样直接响应并下载 `.xlsx`，专门作为可传给 `/online-office?fileUrl=...` 的示例接口地址；必须同时开启【允许匿名】和【响应文件】。

```text
/apiengine/export-excel-advanced-demo--OsClient--iTdos--
/apiengine/export-excel-advanced-demo-preview--OsClient--iTdos--
```

直接访问第二个接口会下载 Excel。需要在线查看时，把完整接口地址 URL 编码后传给 `/online-office` 的 `fileUrl`，页面会透明完成公有预览缓存，再把整个前端链接发送给客户；客户无需登录，打开后强制只读且不显示系统菜单和顶部页签。
