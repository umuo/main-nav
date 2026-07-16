# SentinelNav

SentinelNav 是一个基于 Next.js 的网站导航与可用性监控系统。公开页面按分类展示网站及最近一次检测结果；管理员可以维护网站和分类、切换全局主题，并导入或导出 JSON 数据。

## 技术栈

- Next.js 16 Pages Router、React 19、TypeScript
- Tailwind CSS
- PostgreSQL、Prisma 7.8+（本地开发可自动使用 PGlite）
- JWT HttpOnly Cookie、bcrypt、加密数学验证码

## 环境要求

- Node.js 22.12–22.x（仓库提供 `.nvmrc`）
- PostgreSQL（生产环境或需要连接现有数据库时）

```bash
nvm use
npm install
```

## 本地开发

首次启动直接运行：

```bash
npm run dev
```

当没有配置 `DATABASE_URL` 时，启动器会在 `data/pglite` 自动创建持久化的本地数据库、应用 Prisma 迁移，再启动 Next.js。终端会输出本次运行可用的临时管理员账号和随机密码；停止开发服务时，本地数据库服务也会一并关闭。

## 外部数据库与生产配置

复制环境变量模板：

```bash
cp .env.sample .env.local
```

连接外部 PostgreSQL 或进行生产部署时，必须配置以下变量：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `ADMIN_USERNAME` | 管理员账号 |
| `ADMIN_PASSWORD_HASH` | 管理员密码的 bcrypt Hash |
| `JWT_SECRET` | JWT 签名密钥，至少 32 个字符 |
| `CAPTCHA_SECRET` | 验证码加密密钥，至少 32 个字符，不能与 JWT 密钥相同 |

生成密码 Hash：

```bash
node scripts/generate-password.mjs '你的强密码'
```

生成两个独立的随机密钥：

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Next.js 会展开环境变量中的 `$`。把 bcrypt Hash 写入 `.env.local` 时，请使用密码脚本输出的已转义版本。

## 数据库与启动

外部数据库首次部署或拉取到新迁移后：

```bash
npm run db:deploy
```

开发环境（自动使用 `DATABASE_URL`，未配置时使用本地 PGlite）：

```bash
npm run dev
```

只启动 Next.js、不启动本地数据库或执行迁移：

```bash
npm run dev:next
```

生产环境：

```bash
npm run db:deploy
npm run build
npm start
```

访问 [http://localhost:3000](http://localhost:3000)。项目不再内置默认管理员密码；认证配置缺失时登录接口会拒绝工作。

如果数据库此前通过 `prisma db push` 创建、但没有 Prisma 迁移记录，请先备份并确认现有表结构与初始迁移一致，然后登记初始迁移并应用后续修复迁移：

```bash
npx prisma migrate resolve --applied 20260716000000_init
npm run db:deploy
```

## 常用命令

```bash
npm run typecheck   # TypeScript 检查
npm run lint        # ESLint
npm run build       # 生成 Prisma Client 并构建 Next.js
npm run db:migrate  # 创建开发迁移
npm run db:deploy   # 应用已有迁移
npm run db:studio   # 打开 Prisma Studio
```

## 运行方式

- 页面从 `/api/sites` 和 `/api/categories` 读取公开导航数据。
- 浏览器按需调用 `/api/monitor/check`，只提交站点 ID。服务端从数据库取出 URL，拒绝本机、私网、保留地址、非标准端口和不安全重定向，然后执行检测。
- 检测状态、检测时间和延迟会写回 PostgreSQL。
- 管理写接口要求有效的 JWT HttpOnly Cookie。
- 语言偏好保存在浏览器；主题配置保存在数据库并对所有访客生效。

## API

- `POST /api/auth/login`：管理员登录
- `POST /api/auth/logout`：退出登录
- `GET /api/auth/me`：读取当前登录状态
- `GET /api/captcha/generate`：生成验证码
- `POST /api/captcha/verify`：验证验证码
- `GET|POST /api/sites`：读取或新增网站
- `PUT|DELETE /api/sites/:id`：编辑或删除网站
- `POST /api/sites/import`：导入网站
- `GET|POST /api/categories`：读取或新增分类
- `PUT|DELETE /api/categories/:id`：编辑或删除分类
- `GET|POST /api/config/theme`：读取或修改主题
- `POST /api/monitor/check`：检测已配置的网站，Body 为 `{ "id": "站点 ID" }`
- `GET /api/debug`：管理员鉴权后的数量诊断信息

## 安全边界

- 只监控公网 HTTP/HTTPS 地址，并固定使用 80/443 端口。
- DNS 解析结果和每次重定向都会重新校验；连接固定到已校验的 IP，避免 DNS 重绑定。
- 密码 Hash、JWT 密钥和验证码密钥仅从服务端环境变量读取。
- 验证码答案通过 AES-256-GCM 加密，不会明文下发给浏览器，令牌五分钟后失效。
- 生产环境请使用 HTTPS，并将数据库与密钥交给部署平台的 Secret 管理能力。
