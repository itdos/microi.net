# 使用支持 Brotli 的 Nginx 镜像
# 如果官方镜像不支持 Brotli，可以使用 fholzer/nginx-brotli
FROM fholzer/nginx-brotli:latest
# 备用镜像（不支持 Brotli）
# FROM registry.cn-hangzhou.aliyuncs.com/acs-sample/nginx

# 复制构建产物到 Nginx 目录
COPY dist/  /usr/share/nginx/html/

# 复制 Nginx 配置文件（包含 Brotli 配置）
COPY default.conf /etc/nginx/conf.d/default.conf

# 启动 Nginx 并替换环境变量
CMD ["/bin/bash", "-c", "sed -i \"s@var OsClient = '';@var OsClient = '$OsClient';@;s@var ApiBase = '';@var ApiBase = '$ApiBase';@;s@var ApiCustom = '';@var ApiCustom = '$ApiCustom';@\" /usr/share/nginx/html/index.html && nginx -g \"daemon off;\""]