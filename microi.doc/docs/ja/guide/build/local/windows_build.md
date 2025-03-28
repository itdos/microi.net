# Windows仮想マシンの導入

## 前書き

**.NET** がプラットフォームを越え始めた時間は2014年11月までさかのぼることができ、当時マイクロソフトは **発表した. NET Core** プロジェクト。 **.NET Core** は新しいクロスプラットフォーム、オープンソースの **です. NET** の実装は、サポートを目的としています`Windows、macOS 和 Linux`などの複数のオペレーティングシステム。

::: Tipクロスプラットフォーム能力紹介

2014年から. NET Coreの誕生は2024年までです。NET 9,. ネットのクロスプラットフォーム能力は絶えず発展し、開発フレームワークを統一し、Windows、macOS、Linuxなどの複数のオペレーティングシステムをサポートしている。

:::
 
::: Detailsバージョンリリースの重要な時点
2014年11月: マイクロソフトが発表した. NET Coreプロジェクト、ロゴ. ネットは正式にクロスプラットフォームに向かっている。
2016年6月:. NET Core 1.0が正式に発表されました。これは初めてのクロスプラットフォームです。NETバージョン。
3.2020年11月:. ネット5が発表され、統一されました。NET Frameworkと. NET Core、未来になる. ネットの基礎。
4.2021年11月:. NET 6が発表し、クロスプラットフォームの能力をさらに強化し、より多くの現代化機能を導入した。
5/2022年11月:. NET 7は、パフォーマンスの向上と開発効率の最適化に焦点を当てて発表した。
6.2023年11月:. NET 8リリース、次のLとしてTSバージョンは、クラウドのネイティブ、パフォーマンス、セキュリティのサポートを強化します。
7.2024年11月:. NET 9は、クロスプラットフォームと現代化のアプリケーション開発を引き続き推進すると発表した。
:::



## 準備作業

Microi吾コードバックエンド開発フレームワークは. NETの開発はすでにサポートされています。`Linux`オペレーティングシステムをお勧めします`Linux + Docker`ローカル環境の導入を行う。もしそうなら`Windows`システムは、まず仮想マシンを作成し、インストールする必要があります。`Linux`Os。

## フローステップ

このチュートリアルには、私たちの技術交流エリアに詳細なテキストチュートリアルがあります。参考にしてください。ここでは、次の全体的な手順を簡単に示します

1.アカウントの登録: 公式サイト ( https://www.vmware.com ) にブロードキャストcom (メールボックス) アカウントを登録します。
2.ダウンロード`VMware Workstation Pro`、公式サイト ( https://www.vmware.com ) にダウンロードすることをお勧めします。ロードが少し遅いかもしれませんが、必要ありません`VPN`。
3.インストール`VMware Workstation Pro`、システム選択`CentOS7`。
4.インストール`Docker`阿里雲ミラーの加速を設定します。
5.宝塔パネルを取り付ける`Linux`。

## 対応チュートリアル

1. [w i n t w a r v a v i c r o v e r v a r e c o n t o r a t i o n proインストールチュートリアル](https://lisaisai.blog.csdn.net/article/details/144234355)
2. [VMware Workstation17インストールCentOS7チュートリアル](https://lisaisai.blog.csdn.net/article/details/144532043)
3. [Linux仮想マシンDocker構成阿里雲ミラー加速](https://lisaisai.blog.csdn.net/article/details/144427304)
4. [Linux仮想マシン宝塔パネルインストールチュートリアル](https://lisaisai.blog.csdn.net/article/details/144536912)
5. [Docker極簡チュートリアルクイックスタート](https://lisaisai.blog.csdn.net/article/details/144204174)
6. [Docker常用命令大全 (基礎、鏡像、容器、データボリューム)](https://lisaisai.blog.csdn.net/article/details/144043003)


::: Warning暖かいヒント

上記のチュートリアルでは`Windows`システムのローカル環境は仮想マシンを通して導入されました。`Linux`システムをインストールしました`Docker`、私たちは通過できます`[宝塔面板]`私たちの`Linux`仮想環境。次の手順は、前述のクラウド導入と同様に、唯一注意すべきのはネットワークアドレスの構成です。

:::

## 安定版ミラーソースの交換

ワンクリック配置スクリプトで実行すると、すべてのコンテナを一度に作成できますが、デフォルトのミラーソースは次のとおりです
```bash
 registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
```
これはメインラインに付いているので、プロジェクトの安定したバージョンのミラーソースが必要なので、修正する必要があります。
に変更しました:
 ```bash
 registry.cn-beijing.aliyuncs.com/itdos/api.itdos.com:latest
 ```

ミラーを取り外して、元のフロントエンドとバックエンドのミラーとコンテナを削除するだけで、他は変更されません`端口`変わらない。前後のスクリプトのソースコードを以下に示します

1.元のコンテナとミラーを削除するには:

::: Code-group

```bash [前端脚本]
#删除容器
docker rm -f microi-install-client
#删除镜像
docker rmi -f [IMAGE ID]
```

```bash [后端脚本]
#删除容器
docker rm -f microi-install-api
#删除镜像
docker rmi -f [IMAGE ID]
```

:::

2.前後のスクリプトを再実行する:
::: Code-group

```bash [前端脚本]

docker run -itd --name microi-install-client  -p 26934:80  \
 --privileged=true  --restart=always  --log-opt max-size=10m --log-opt max-file=10 \
 -e "OsClient=fengmei" \
 -e "ApiBase=https://microi_api.fmic.cn:4443" \
 -v /etc/localtime:/etc/localtime \
 -v /usr/share/fonts:/usr/share/fonts  \
 -d registry.cn-beijing.aliyuncs.com/itdos/os.itdos.com:latest


```

```bash [后端脚本]
docker run -itd --restart=always --log-opt max-size=10m --log-opt max-file=10 --privileged=true \
  --name microi-install-api -p 54411:80 \
  -e "OsClient=fengmei" \
  -e "OsClientType=Product" \
  -e "OsClientNetwork=Internal" \
  -e "OsClientDbConn=Data Source=172.19.10.157;Database=microi_demo;User Id=root;Password=5PjBrSjoA7gGM73;Port=55879;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;" \
  -e "OsClientRedisHost=172.19.10.157" \
  -e "OsClientRedisPort=52712" \
  -e "OsClientRedisPwd=zErUNmnCfOZ96Z1" \
  -e "AuthServer=http://172.19.10.157:54411" \
  -v /etc/localtime:/etc/localtime \
  -v /usr/share/fonts:/usr/share/fonts \
  -d registry.cn-beijing.aliyuncs.com/itdos/api.itdos.com:latest
```

:::


 
- **AuthServer**：バックエンドサービスアドレスとして設定するには、デフォルトは '172.19.10.157:54411 'です
- **ApiBase**：バックエンド・サービス・アドレスとして構成するには、デフォルトで「https:// microi_api.fmical: 4443」 ('172.19.10.157:54411」のエクストラネットマッピングアドレス) となります

::: Warning特別注意
実は、両方のポートパラメータはバックエンド・サーバ「api」のインタフェース・アドレスを指していますが、ローカリゼーション配置がエクストラネット・アクセスを構成する場合、「ApiBase」はバックエンド・インタフェース・マッピングのエクストラネット・アドレスとして構成されます。
:::

3.その他のパラメータコメント

```js
1. OsClient：客户端标识，可以自定义，这里我们设置为 `fengmei`
2. OsClientType：客户端类型，这里设置为 `Product`
3. OsClientNetwork：客户端网络类型，这里设置为 `Internal`
4. OsClientDbConn：数据库连接字符串，这里设置为 `Data Source=172.19.10.157;Database=microi_demo;User Id=root;Password=5PjBrSjoA7gGM73;Port=55879;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;`
5. OsClientRedisHost：Redis 主机地址，这里设置为 `172.19.10.157`
6. OsClientRedisPort：Redis 端口，这里设置为 `52712`
7. OsClientRedisPwd：Redis 密码，这里设置为 `zErUNmnCfOZ96Z1`
8. AuthServer：授权服务器地址，这里设置为 `http://172.19.10.157:54411`
9. ApiBase：API 地址，这里设置为 `https://microi_api.xxx.cn:4443`
10. 端口：前端端口为 `26934`，后端端口为 `54411`
11. 镜像源：前端镜像源为 `registry.cn-beijing.aliyuncs.com/itdos/os.itdos.com:latest`，后端镜像源为 `registry.cn-beijing.aliyuncs.com/itdos/api.itdos.com:latest`

```
4.その他の注意事項

- プル・ミラーリングに認証が必要な場合は、次のコマンドを実行します

```bash
docker login --username=admin@itdos.com registry.cn-beijing.aliyuncs.com
--password：xxxx
```
> 注意: 該当アドレスまたはパスワードが変更になる場合があります。

- バックエンドのコンテナ起動エラーの場合は、コンテナログにアクセスして確認します
```bash
docker logs -f microi-install-api
```
> 注意: エラーとデータベースが関係している場合は、データベース名が正しいか、ポートが正しいか、ユーザー名のパスワードが正しいかを確認してください。

---

::: Danger特別注意
上記のスクリプトは、実際の導入シーンの例であり、一時的に動的である。スクリプトを配備するたびに、パラメータ、ポート番号などが異なる可能性があります。
:::