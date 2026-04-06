# 容器化部署指南 (41XXX 端口范围)

这份指南帮助你在容器中使用 41XXX 端口范围部署 Multica。

## 快速开始

```bash
# 1. 使用预配置的容器环境文件
cp .env.container .env.container.local

# 2. (可选) 修改配置
# 编辑 .env.container.local 调整端口或其他配置

# 3. 运行部署脚本
./scripts/deploy-container.sh
```

## 端口分配

| 服务       | 端口  | 说明              |
|------------|-------|-------------------|
| PostgreSQL | 41500 | 数据库            |
| Backend    | 41501 | Go API 服务       |
| Frontend   | 41502 | Next.js 前端      |

## 手动部署步骤

如果不想使用脚本，可以手动执行：

```bash
# 1. 加载环境变量
export $(grep -v '^#' .env.container | xargs)

# 2. 构建镜像
docker compose build

# 3. 启动数据库
docker compose up -d postgres

# 4. 等待数据库就绪后运行迁移
docker compose --profile migrate run --rm migrate

# 5. 启动所有服务
docker compose up -d

# 6. 查看日志
docker compose logs -f
```

## 常用命令

```bash
# 查看所有服务状态
docker compose ps

# 查看日志
docker compose logs -f
docker compose logs -f backend   # 只看后端日志
docker compose logs -f frontend  # 只看前端日志

# 重启服务
docker compose restart backend
docker compose restart frontend

# 停止所有服务
docker compose down

# 完全清理（包括数据卷）
docker compose down -v
```

## 环境变量配置

编辑 `.env.container` 文件来修改配置：

### 必需配置

| 变量名       | 默认值                            | 说明                  |
|--------------|-----------------------------------|-----------------------|
| `JWT_SECRET` | (自动生成)                        | 用于 JWT 签名，请设置强密码 |
| `RESEND_API_KEY` | -                             | Resend API Key (邮件服务) |

### 可选配置

| 变量名              | 默认值              | 说明              |
|---------------------|---------------------|-------------------|
| `POSTGRES_PORT`     | 41500               | 数据库外部端口    |
| `BACKEND_PORT`      | 41501               | 后端服务外部端口  |
| `FRONTEND_PORT`     | 41502               | 前端服务外部端口  |
| `POSTGRES_PASSWORD` | multica             | 数据库密码        |
| `LOG_LEVEL`         | info                | 日志级别          |

## CLI/Daemon 配置

部署完成后，配置 CLI 指向你的容器服务：

```bash
export MULTICA_APP_URL=http://localhost:41502
export MULTICA_SERVER_URL=ws://localhost:41501/ws

# 登录
multica login

# 启动守护进程
multica daemon start
```

## 故障排除

### 端口被占用

```bash
# 检查端口占用
lsof -i :41500
lsof -i :41501
lsof -i :41502

# 停止占用端口的进程或修改 .env.container 中的端口
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 状态
docker compose ps postgres
docker compose logs postgres

# 手动测试连接
docker exec -it multica-postgres pg_isready -U multica
```

### 服务启动失败

```bash
# 查看详细日志
docker compose logs backend
docker compose logs frontend

# 检查健康状态
curl http://localhost:41501/health
```

### 重置所有数据

```bash
# 停止服务并删除数据卷
docker compose down -v

# 重新部署
./scripts/deploy-container.sh
```

## 生产环境注意事项

1. **修改 JWT_SECRET**: 使用强随机字符串
   ```bash
   openssl rand -hex 32
   ```

2. **配置邮件服务**: 设置 `RESEND_API_KEY` 用于邮件验证

3. **配置 HTTPS**: 使用反向代理 (Nginx/Caddy) 提供 TLS

4. **修改数据库密码**: 不要使用默认密码

5. **定期备份**: 备份 PostgreSQL 数据卷
