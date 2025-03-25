<!-- 构建部署 -->

構築配置 (整備待ち)::: ヒント
このプロジェクトはnginx配置を採用しています。nginxの配置に慣れていない場合は、まずnginxの基本配置を学んでください。
:::梱包項目'Pnpm' コマンドでプロジェクトをパッケージ化して、 'dist' フォルダを生成します。

```bash
pnpm run build:pro
```


Nginxをインストールする::: ヒント- 如果你已经安装了Nginx，请跳过此步骤。
- 服务器安装nginx，nginx安装步骤根据操作系统自行百度。 [nginx下载地址](http://nginx.org/en/download.html)
:::
Nginxの設定1. 进入nginx目录的`conf`文件夹，新建`conf.d`文件夹，方便我们配置文件分类。
2. 打开nginx.conf在http 配置里加上 include conf.d/*.conf;这样nginx就会去读取conf.d目录下的配置文件。
3. 进入conf.d目录，新建`microi.conf`填入以下配置
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

Nginxを起動するCmdからnginxインストールディレクトリまで、コマンド「startnginx」を実行し、フロントエンドアドレスにアクセスし、フロントエンドページにアクセスできればフロントエンド配置が成功したことを示します。

補充待ち