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