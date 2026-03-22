# 📑Office Online Editing

> Platform Integration * * OnlyOffice * * The free community version serves as a document editing and preview service and supports online editing of Word, Excel and PPT.

---

## 🐳OnlyOffice deployment through Docker orchestration

::: tip💡Prompt
In case of`onlyoffice/documentserver`Pull timeout, can use my code public mirror:`registry.cn-hangzhou.aliyuncs.com/microios/onlyoffice-documentserver:202509`
:::
::: details Expand to view the JSON configuration (line 22)
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

## ⚙️ Set up reverse proxy and platform configuration

1. Assume that the reverse proxy address is:`https://net.itdos.net:1021`
2. Set **in Platform** System Settings**'OnlyOfficeApiBase'**Field value is`https://net.itdos.net:1021`(Create first if this field is not present)

::: tip💡Effect
After the configuration is completed, all attachments in PPT, Excel and Word formats in the platform will be opened online through OnlyOffice by default.
:::