# SentinelNav - 网站监控系统

基于 Next.js 的网站监控系统，支持管理员登录、验证码验证和实时监控。

## 功能特性

- ✅ 网站状态实时监控
- ✅ 管理员后台管理
- ✅ 安全的服务端认证
- ✅ 验证码保护
- ✅ 多语言支持 (中文/英文)
- ✅ 响应式设计

## 技术栈

- **框架**: Next.js 14
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **认证**: bcryptjs

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

编辑 `.env.local` 文件：

```env
ADMIN_USERNAME=admin
# 注意: $ 符号需要转义为 \$，否则 Next.js 会尝试将其作为变量展开
ADMIN_PASSWORD_HASH='\$2a\$10\$o32YRX3kfcC4mgmHVewr/.cMWj5EORQGWA.mvswBOdpZ65tzmcFze'
```

默认密码是 `admin123`

### 3. 生成新密码 (可选)

```bash
node scripts/generate-password.js 你的密码
```

将生成的 hash 复制到 `.env.local` 的 `ADMIN_PASSWORD_HASH`

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 5. 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
├── pages/
│   ├── api/              # API 路由
│   │   ├── auth/         # 认证相关
│   │   ├── captcha/      # 验证码
│   │   └── monitor/      # 监控
│   ├── _app.tsx          # App 入口
│   └── index.tsx         # 主页面
├── components/           # React 组件
├── contexts/             # Context 提供者
├── services/             # 服务层
├── utils/                # 工具函数
├── styles/               # 全局样式
└── scripts/              # 工具脚本
```

## 安全说明

- 管理员密码使用 bcrypt 加密存储
- 验证码在服务端生成和验证
- 网站监控请求通过服务端代理
- 敏感信息存储在环境变量中

## API 端点

- `POST /api/auth/login` - 管理员登录
- `GET /api/captcha/generate` - 生成验证码
- `POST /api/captcha/verify` - 验证验证码
- `POST /api/monitor/check` - 检查网站状态

## 许可证

MIT
