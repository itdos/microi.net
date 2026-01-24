FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
MAINTAINER iTdos
LABEL description="iTdos"
COPY publish/ /app
WORKDIR /app
EXPOSE 80

# 设置时区上海
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
RUN echo 'Asia/Shanghai' >/etc/timezone

# 清空apt源文件
#RUN echo > /etc/apt/sources.list

#镜像加速 如果用了下面的mirrors.ustc.edu.cn就需要下面这2句
#RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list
#RUN sed -i 's/security.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list

# apt修改为国内源  PS：这个有时候会崩掉
#RUN echo  'deb http://mirrors.ustc.edu.cn/debian buster main contrib non-free \ndeb http://mirrors.ustc.edu.cn/debian buster-backports main contrib non-free \ndeb http://mirrors.ustc.edu.cn/debian buster-proposed-updates main contrib non-free \ndeb http://mirrors.ustc.edu.cn/debian-security buster/updates main contrib non-free' >> /etc/apt/sources.list 

# 清空apt缓存
#RUN apt-get clean
#RUN cat /etc/apt/sources.list

# 更新系统
#RUN apt-get update
# 安装PuppeteerSharp依赖的库（有时候会出问题）
#RUN apt-get install libnss3-dev -y && apt-get install libatk1.0-0 -y && apt-get install libatk-bridge2.0-0 libgtk-3.0 -y &&  apt-get install libgbm-dev -y && apt-get install libasound2 -y && apt-get install libglu1 -y && apt-get install libaio1 libaio-dev -y && apt-get install -y libgdiplus -y && apt-get install unzip -y && apt-get install wget -y

#图片压缩
#RUN apt-get install -y libgdiplus

# 从Cos下载
#RUN wget -O .local-chromium.zip "https://file.microios.com/jsnzk-public/jsnzk/file/upload/chrome-linux.zip"
# 解压缩
#RUN unzip .local-chromium.zip
# 删除.local-chromium.zip
#RUN rm -rf .local-chromium.zip
# 设置权限
#RUN chmod 777 /app/.local-chromium/Linux-884014/chrome-linux/chrome


CMD ["dotnet", "Microi.net.Api.dll", "--urls", "http://0.0.0.0:80"]
