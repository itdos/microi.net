<! -- デプロイの構築 -->
# 構築配置 (整備待ち)
::: ヒント
このプロジェクトはnginx配置を採用しています。nginxの配置に慣れていない場合は、まずnginxの基本配置を学んでください。
:::
## 梱包項目

通過`pnpm`コマンドパッケージ項目、生成`dist`ファイル。

```bash
pnpm run build:pro
```

## Nginxをインストールする
::: ヒント
- Nginxがインストールされている場合は、この手順を省略してください。
- サーバはnginxをインストールし、nginxのインストール手順はオペレーティングシステムに基づいて百度である。 [Nginxダウンロードアドレス](http://nginx.org/en/download.html)
:::
## Nginxの設定
Nginxディレクトリに入る`conf`フォルダ、新規作成`conf.d`フォルダは、私たちのプロファイルの分類に便利です。
Nginx.confを開いてhttp構成にinclude conf.d/*.confを追加するnginxはconf.dディレクトリの構成ファイルを読み取ります。
3.conf.dディレクトリに入り、新規作成します`microi.conf`次の設定を入力します
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
## Nginxを起動する
Cmdからnginxインストールディレクトリに行き、コマンドを実行します`start nginx`、フロントエンドアドレスにアクセスし、フロントエンドページにアクセスできればフロントエンドの配置が成功したことを示します。

補充待ち
