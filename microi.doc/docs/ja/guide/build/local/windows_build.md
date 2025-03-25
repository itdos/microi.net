Windows仮想マシンの導入前書き**. NET ** がプラットフォームを越え始めた時間は2014年11月までさかのぼることができ、当時マイクロソフトは ** を発表した. NET Core ** プロジェクト。 **. NET Core ** は新しいクロスプラットフォーム、オープンソースの ** です. NET ** は、「windows、macOS、linux」などの複数のオペレーティングシステムをサポートするように設計されています。

::: Tipクロスプラットフォーム能力紹介

2014年から. NET Coreの誕生は2024年までです。NET 9,. ネットのクロスプラットフォーム能力は絶えず発展し、開発フレームワークを統一し、Windows、macOS、Linuxなどの複数のオペレーティングシステムをサポートしている。

:::
 
::: Detailsバージョンリリースの重要な時点1. 2014 年 11 月：微软宣布 .NET Core 项目，标志着 .NET 正式迈向跨平台。
2. 2016 年 6 月：.NET Core 1.0 正式发布，这是第一个跨平台的 .NET 版本。
3. 2020 年 11 月：.NET 5 发布，统一了 .NET Framework 和 .NET Core，成为未来 .NET 的基础。
4. 2021 年 11 月：.NET 6 发布，进一步增强了跨平台能力，并引入了更多现代化功能。
5. 2022 年 11 月：.NET 7 发布，专注于性能提升和开发效率优化。
6. 2023 年 11 月：.NET 8 发布，作为下一个 LTS 版本，增强了云原生、性能和安全性支持。
7. 2024 年 11 月：.NET 9 发布，将继续推动跨平台和现代化应用开发。
:::



準備作業Microi吾コードバックエンド開発フレームワークは. NETは9.0で開発され、すでに「linux」オペレーティングシステムをサポートしているので、「linux docker」を使用してローカル環境の導入を推奨しています。「Windows」システムの場合は、まず仮想マシンを作成し、「linux」オペレーティングシステムをインストールする必要があります。

フローステップこのチュートリアルには、私たちの技術交流エリアに詳細なテキストチュートリアルがあります。参考にしてください。ここでは、次の全体的な手順を簡単に示します

1. 注册账号：前往官网（https://www.vmware.com）注册 broadcom（邮箱）账号。
2. 下载 `VMware Workstation Pro`,建议前往官网（https://www.vmware.com）下载，可能加载稍微有点慢，但是不需要 `VPN`。
3. 安装 `VMware Workstation Pro` ，系统选择 `CentOS7` 。
4. 安装 `Docker` 并配置阿里云镜像加速。
5. 安装宝塔面板 `Linux`。

対応チュートリアル1. [Windows VMware Workstation Pro安装教程](https://lisaisai.blog.csdn.net/article/details/144234355)
2. [VMware Workstation17 安装 CentOS7 教程](https://lisaisai.blog.csdn.net/article/details/144532043)
3. [Linux虚拟机 Docker 配置阿里云镜像加速](https://lisaisai.blog.csdn.net/article/details/144427304)
4. [Linux虚拟机宝塔面板安装教程](https://lisaisai.blog.csdn.net/article/details/144536912)
5. [Docker 极简教程 快速入门](https://lisaisai.blog.csdn.net/article/details/144204174)
6. [Docker 常用命令大全（基础、镜像、容器、数据卷）](https://lisaisai.blog.csdn.net/article/details/144043003)


::: Warning暖かいヒント

上記のチュートリアルでは、「windows」システムのローカル環境に仮想マシンを介して「linux」システムを導入し、「docker' 」をインストールしました「 [宝塔パネル] 」で「linux」の仮想環境を視覚的に管理することができます。次の手順は、前述のクラウド導入と同様に、唯一注意すべきのはネットワークアドレスの構成です。

:::

安定版ミラーソースの交換ワンクリック配置スクリプトで実行すると、すべてのコンテナを一度に作成できますが、デフォルトのミラーソースは次のとおりです```bash
 registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
```

これはメインラインに付いているので、プロジェクトの安定したバージョンのミラーソースが必要なので、修正する必要があります。
に変更しました: ```bash
 registry.cn-beijing.aliyuncs.com/itdos/api.itdos.com:latest
 ```


ミラーを取り外して、元のフロントエンドとバックエンドのミラーとコンテナを削除するだけで、他は変更されず、「ポート」は変更されません。前後のスクリプトのソースコードを以下に示します

1. 删除原有的容器和镜像：

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

2. 重新执行前后端脚本：
::: code-group

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


 
- **AuthServer**：要配置为后端服务地址，默认为 `172.19.10.157:54411`
- **ApiBase**：要配置为后端服务地址，默认为 `https://microi_api.fmic.cn:4443` （ `172.19.10.157:54411` 的外网映射地址） 

::: Warning特別注意
実は、両方のポートパラメータはバックエンド・サーバ「api」のインタフェース・アドレスを指していますが、ローカリゼーション配置がエクストラネット・アクセスを構成する場合、「ApiBase」はバックエンド・インタフェース・マッピングのエクストラネット・アドレスとして構成されます。
:::

3. 其它参数注解

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

4. 其它注意事项

- 如果拉取镜像需要授权验证，请执行以下命令:

```bash
docker login --username=admin@itdos.com registry.cn-beijing.aliyuncs.com
--password：xxxx
```

注意: この住所またはパスワードは変更される可能性があります。

- 如果后端容器启动报错,进入容器日志查看：
```bash
docker logs -f microi-install-api
```

注意: エラーがデータベースに関連している場合は、データベース名が正しいか、ポートが正しいか、ユーザー名のパスワードが正しいかを確認してください。

---

::: Danger特別注意
上記のスクリプトは、実際の導入シーンの例であり、一時的に動的である。スクリプトを配備するたびに、パラメータ、ポート番号などが異なる可能性があります。
:::