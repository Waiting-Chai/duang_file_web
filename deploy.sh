#!/bin/bash

# 设置错误处理，但不立即退出，以便记录错误
set -o pipefail

# 创建日志文件
LOG_FILE="deploy_frontend.log"
echo "Starting frontend deployment at $(date)" > $LOG_FILE

# 清理旧容器和镜像
echo "Cleaning up old containers and images..." | tee -a $LOG_FILE
docker rm -f duang-frontend 2>/dev/null || true
echo "Cleanup completed" | tee -a $LOG_FILE

# 检查Docker是否正常运行
echo "Checking Docker status..." | tee -a $LOG_FILE
docker info > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: Docker is not running or not accessible" | tee -a $LOG_FILE
  exit 1
fi
echo "Docker is running" | tee -a $LOG_FILE

# 拉取基础镜像
echo "Pulling base images..." | tee -a $LOG_FILE
docker pull node:20-alpine | tee -a $LOG_FILE
docker pull nginx:alpine | tee -a $LOG_FILE
echo "Base images pulled" | tee -a $LOG_FILE

# 构建前端镜像
echo "Building frontend image..." | tee -a $LOG_FILE
docker build -t duang-frontend . 2>&1 | tee -a $LOG_FILE
BUILD_EXIT_CODE=${PIPESTATUS[0]}
if [ $BUILD_EXIT_CODE -ne 0 ]; then
  echo "ERROR: Failed to build frontend image with exit code $BUILD_EXIT_CODE" | tee -a $LOG_FILE
  echo "Trying to build with more verbose output..." | tee -a $LOG_FILE
  # 尝试使用更详细的输出进行构建
  docker build --progress=plain -t duang-frontend . 2>&1 | tee -a $LOG_FILE
  VERBOSE_BUILD_EXIT_CODE=${PIPESTATUS[0]}
  if [ $VERBOSE_BUILD_EXIT_CODE -ne 0 ]; then
    echo "ERROR: Verbose build also failed with exit code $VERBOSE_BUILD_EXIT_CODE" | tee -a $LOG_FILE
    exit 1
  fi
fi
echo "Frontend image built successfully" | tee -a $LOG_FILE

# 检查端口是否被占用
echo "Checking if port 5173 is in use..." | tee -a $LOG_FILE
lsof -i :5173 > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "WARNING: Port 5173 is already in use, will use port 5174 instead" | tee -a $LOG_FILE
  PORT=5174
else
  echo "Port 5173 is available" | tee -a $LOG_FILE
  PORT=5173
fi

# 运行前端容器
echo "Running frontend container on port $PORT..." | tee -a $LOG_FILE
docker run -d -p $PORT:80 --name duang-frontend duang-frontend | tee -a $LOG_FILE
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to run frontend container" | tee -a $LOG_FILE
  exit 1
fi

# 检查容器状态
echo "Checking container status..." | tee -a $LOG_FILE
docker ps | grep duang-frontend | tee -a $LOG_FILE
if [ $? -ne 0 ]; then
  echo "ERROR: Container is not running" | tee -a $LOG_FILE
  echo "Container logs:" | tee -a $LOG_FILE
  docker logs duang-frontend | tee -a $LOG_FILE
  exit 1
fi

echo "Frontend deployment completed at $(date)" | tee -a $LOG_FILE
echo "Frontend is available at http://localhost:$PORT" | tee -a $LOG_FILE

# 输出日志内容
cat $LOG_FILE