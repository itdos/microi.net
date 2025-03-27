FROM nginx
COPY h5/  /usr/share/nginx/html/
COPY default.conf /etc/nginx/conf.d/default.conf
CMD ["/bin/bash", "-c", "sed -i \"s@var OsClient = '';@var OsClient = '$OsClient';@;s@var ApiBase = '';@var ApiBase = '$ApiBase';@\" /usr/share/nginx/html/index.html; nginx -g \"daemon off;\""]