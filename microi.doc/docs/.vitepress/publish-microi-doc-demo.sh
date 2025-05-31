# windows发布需要将此文件修改为.bat格式。macos若遇权限问题无法运行此脚本，请执行命令#chmod -R 777 publish-microi-doc.sh
echo "请输入本次要发布的os版本号："
read version

docker login --username=admin@itdos.com --password=密码 registry.cn-beijing.aliyuncs.com
docker build -t microi.doc .

docker tag microi.doc registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest
docker push registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest

docker tag microi.doc registry.cn-beijing.aliyuncs.com/itdos/microi.doc:$version
docker push registry.cn-beijing.aliyuncs.com/itdos/microi.doc:$version