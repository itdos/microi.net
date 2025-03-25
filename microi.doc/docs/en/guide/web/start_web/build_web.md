<! -- Build Deployment -->
# Build Deployment (to be refined)
::: tip tip
this project uses nginx deployment. if you are not familiar with nginx configuration, learn the basic configuration of nginx first.
:::
## Package Project

Package the project with the 'pnpm' command to generate the 'dist' folder.

```bash
pnpm run build:pro
```

## Install Nginx
::: tip tip
If you already have Nginx installed, skip this step.
-The server installs nginx, and the nginx installation steps are based on the operating system. [nginx download address](http://nginx.org/en/download.html)
:::
## Configure Nginx
1. Enter the' conf' folder of nginx directory and create a' conf.d' folder to facilitate our configuration file classification.
2. Open nginx.conf and add the include conf.d/*.conf to the http configuration; In this way, nginx will read the configuration file in the conf.d directory.
3. Enter the conf.d directory, create a' microi.conf' and fill in the following configuration
```nginx
  server {
        listen       54321;
        server_name  localhost;
        location / {
            root   "D:\\nginx-1.20.2\\web\\simple\\dist";
			try_files $uri $uri/ @router;
            index  index.html index.htm;
			error_page 405 =200 http://$host$request_uri;
        }
	   #压缩chunk-vendors.js,加快首次加载得速度
	   gzip on;
       gzip_min_length 1k;
       gzip_comp_level 9;
       gzip_types text/plain application/javascript application/x-javascript text/css application/xml text/javascript application/x-httpd-php image/jpeg image/gif image/png;
       gzip_vary on;
       gzip_disable "MSIE [1-6]\.";
	   #代理后端接口
	   location /api/ {
			proxy_pass http://192.168.1.16:18000;   #转发请求的后端地址
            rewrite ^/api/(.*)$ /$1 break;
		}
	   location @router {
            rewrite ^.*$ /index.html last;
        }
       error_page   500 502 503 504  /50x.html;
       location = /50x.html {
            root   html;
        }
  }
 ```
## 启动Nginx
cmd到nginx安装目录，执行命令`start nginx`,访问前端地址，如果能够访问前端页面则表示前端部署成功。

待补充
