# 使用单阶段构建以简化过程
FROM node:20-alpine

WORKDIR /app

# 复制所有文件
COPY . .

# 安装依赖并构建应用
RUN npm install && npm run build

# 安装nginx
RUN apk add --no-cache nginx && \
    mkdir -p /run/nginx && \
    mkdir -p /usr/share/nginx/html

# 配置nginx
RUN mkdir -p /var/log/nginx

# 创建自定义nginx配置
COPY nginx.conf /etc/nginx/nginx.conf.template
RUN cat /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# 将构建好的文件复制到nginx目录
RUN cp -r /app/dist/* /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]