# Office在线编辑
## 介绍
>* 目前平台集成的OnlyOffice免费社区版做为文档编辑、预览服务，后期可能会集成更多

## 通过编排部署onlyoffice服务
>* 如遇onlyoffice/documentserver超时，可使用吾码公开镜像：registry.cn-hangzhou.aliyuncs.com/microios/onlyoffice-documentserver:202509
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

## 设置反向代理、配置平台系统设置
>* 假设咱们的反向代理地址为：[https://net.itdos.net:1021](https://net.itdos.net:1021)
>* 在平台系统设置中给【OnlyOfficeApiBase】字段（若无则创建）设置值为【https://net.itdos.net:1021】

## 之后平台的所有附件如果是ppt、excel、word格式文件，则会默认以onlyoffice打开