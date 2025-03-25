<! -- デプロイの構築 -->
# 構築配置 (整備待ち)
::: ヒント
このプロジェクトはnginx配置を採用しています。nginxの配置に慣れていない場合は、まずnginxの基本配置を学んでください。
:::
## 梱包項目

'Pnpm' コマンドでプロジェクトをパッケージ化して、 'dist' フォルダを生成します。

```bash
pnpm run build:pro
```

## Nginxをインストールする
::: ヒント
-あなたは既にNginxをインストールしている场合は、この手顺をスキップしてください。
-サーバはnginxをインストールし、nginxのインストール手順はオペレーティングシステムに基づいて百度。 [Nginxダウンロードアドレス](http://nginx.org/en/download.html)
:::
## Nginxの設定
1.nginxディレクトリの「conf」フォルダに入り、「conf.D」フォルダを新規作成して、ファイルの分類を簡単に設定します。
Nginx.confを開いてhttp構成にinclude conf.d/*.confを追加するnginxはconf.dディレクトリの構成ファイルを読み取ります。
3.conf.dディレクトリに入り、「microi.conf」を新規作成して次の設定を入力します
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
