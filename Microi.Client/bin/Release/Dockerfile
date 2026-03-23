# 使用稳定的官方 Nginx 镜像
# FROM nginx:stable-alpine
# 阿里云镜像备用
FROM registry.cn-hangzhou.aliyuncs.com/acs-sample/nginx

# 复制构建产物到 Nginx 目录
COPY dist/  /usr/share/nginx/html/

# 复制 Nginx 配置文件
COPY default.conf /etc/nginx/conf.d/default.conf

# 启动 Nginx 并替换环境变量
CMD ["/bin/bash", "-c", "sed -i \"s@var OsClient = '';@var OsClient = '$OsClient';@;s@var ApiBase = '';@var ApiBase = '$ApiBase';@;s@var ApiCustom = '';@var ApiCustom = '$ApiCustom';@\" /usr/share/nginx/html/index.html && nginx -g \"daemon off;\""]