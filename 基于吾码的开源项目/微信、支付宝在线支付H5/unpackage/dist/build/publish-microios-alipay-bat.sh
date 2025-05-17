# windows发布请将此文件修改为.bat格式
docker login --username=microios --password=这是密码 registry.cn-hangzhou.aliyuncs.com
docker build -t alipay-h5 .
docker tag alipay-h5 registry.cn-hangzhou.aliyuncs.com/microios/alipay-h5:latest
docker push registry.cn-hangzhou.aliyuncs.com/microios/alipay-h5:latest