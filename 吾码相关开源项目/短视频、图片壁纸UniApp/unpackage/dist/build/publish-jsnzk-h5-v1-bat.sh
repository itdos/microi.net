# windows发布请将文件格式修改为.bat
docker login --username=microios --password=这是密码 registry.cn-hangzhou.aliyuncs.com
docker build -t jsnzk-h5-v1 .
docker tag jsnzk-h5-v1 registry.cn-hangzhou.aliyuncs.com/microios/jsnzk-h5-v1:latest
docker push registry.cn-hangzhou.aliyuncs.com/microios/jsnzk-h5-v1:latest