# Office Online Editor
## Introduction
> * currently, the free community version of OnlyOffice integrated on the platform is used as document editing and preview services, and more may be integrated later.

## Deploy onlyoffice services through orchestration
> * in case of onlyoffice/documentserver timeout, you can use my code to publicly mirror:
```json
version: '3.8'
services:
  documentserver:
    image: onlyoffice/documentserver
    container_name: onlyoffice
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
      - /volume1/docker/onlyoffice/DocumentServer/logs:/var/log/onlyoffice
      - /volume1/docker/onlyoffice/DocumentServer/data:/var/www/onlyoffice/Data
      - /volume1/docker/onlyoffice/DocumentServer/lib:/var/lib/onlyoffice
      - /volume1/docker/onlyoffice/DocumentServer/db:/var/lib/postgresql
```

## Set up reverse proxy, configure platform system settings
> * suppose our reverse proxy address is:[https://net.itdos.net:1021](https://net.itdos.net:1021)
> * in the platform system settings, set the value of [OnlyOfficeApiBase] field (if not created) to [https://net.itdos.net:1021]]

## After that, if all attachments of the platform are ppt, excel and word format files, they will be opened in onlyoffice by default.