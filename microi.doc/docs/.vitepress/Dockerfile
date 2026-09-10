# 使用阿里云镜像加速
ARG MICROI_NGINX_IMAGE=registry.cn-hangzhou.aliyuncs.com/microios/nginx:acs-sample-20260909
FROM ${MICROI_NGINX_IMAGE}

# 复制构建产物到 nginx 目录
COPY dist/ /usr/share/nginx/html/

# 复制 nginx 配置
COPY default.conf /etc/nginx/conf.d/default.conf

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
