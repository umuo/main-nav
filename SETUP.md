# 快速启动指南

## 项目已改造为 Next.js

项目已从纯前端 Vite 项目改造为 Next.js 全栈项目，敏感信息已移至服务端处理。

## 改造内容

### 1. 后端 API 路由
- `/api/auth/login` - 管理员登录验证（密码在服务端验证）
- `/api/captcha/generate` - 服务端生成验证码
- `/api/captcha/verify` - 服务端验证验证码
- `/api/monitor/check` - 服务端代理网站状态检查

### 2. 安全改进
- 管理员密码使用 bcrypt 加密存储在环境变量
- 验证码生成和验证在服务端完成
- 网站监控请求通过服务端代理，避免 CORS 问题
- 敏感配置从前端代码移除

### 3. 环境变量
所有敏感信息存储在 `.env.local` 文件中：
- `ADMIN_USERNAME` - 管理员用户名
- `ADMIN_PASSWORD_HASH` - 管理员密码的 bcrypt hash

## 安装步骤

### 1. 清理旧依赖
```bash
rm -rf node_modules package-lock.json
```

### 2. 安装新依赖
```bash
npm install
```

### 3. 配置环境变量
确保 `.env.local` 文件存在并包含：
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

默认密码是 `admin123`

### 4. 生成自定义密码（可选）
```bash
node scripts/generate-password.js 你的新密码
```

将输出的 hash 复制到 `.env.local` 文件中

### 5. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:3000

## 生产部署

### 1. 构建
```bash
npm run build
```

### 2. 启动
```bash
npm start
```

## 主要变化

### 前端
- 使用 Next.js Pages Router
- 验证码改为简单的数学题（服务端验证）
- 登录验证通过 API 调用
- 网站监控通过 API 调用

### 后端
- 新增 API 路由处理敏感操作
- 使用 bcryptjs 进行密码加密
- 服务端代理网站状态检查

## 注意事项

1. 生产环境务必修改默认密码
2. `.env.local` 文件不要提交到 Git
3. 确保服务器环境变量正确配置
4. 建议使用 HTTPS 部署

## 故障排查

### 端口被占用
```bash
# 修改端口
npm run dev -- -p 3001
```

### 依赖安装失败
```bash
# 使用国内镜像
npm install --registry=https://registry.npmmirror.com
```

### 构建失败
```bash
# 清理缓存
rm -rf .next
npm run build
```
