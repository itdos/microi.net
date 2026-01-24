# windows发布需要将此文件修改为.bat格式
# macos若遇权限问题无法运行此脚本，请执行命令#chmod -R 777 publish-demo.sh
# 请修改脚本中的[阿里云docker帐号]、[阿里云docker密码]、[地域]、[命名空间]

echo "请输入本次要发布的microi-api版本号："
read version

docker login --username=阿里云docker帐号 --password=阿里云docker密码 registry.cn-地域.aliyuncs.com
docker build -t microi-api .

docker tag microi.doc registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest

docker tag microi.doc registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version