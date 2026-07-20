# SentinelNav

SentinelNav 是一个基于 Next.js 的网站导航与双视角连通性监控系统。公开页面同时展示当前浏览器网络与服务器侧的最近一次检测结果；管理员可以维护网站和分类、切换全局主题，并导入或导出 JSON 数据。

## 技术栈

- Next.js 16 Pages Router、React 19、TypeScript
- Tailwind CSS
- PostgreSQL、Prisma 7.8+（本地开发可自动使用 PGlite）
- JWT HttpOnly Cookie、bcrypt、Cloudflare Turnstile、数据库级登录限流

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

当没有配置 `DATABASE_URL` 时，启动器会在 `data/pglite` 自动创建持久化的本地数据库、应用 Prisma 迁移，再启动 Next.js。终端会输出本地管理员账号和随机密码，凭据保存在已被 Git 忽略的 `data/dev-credentials.json`，重启后不会变化；停止开发服务时，本地数据库服务也会一并关闭。

## 外部数据库与生产配置

复制环境变量模板：

```bash
cp .env.sample .env.local
```

连接外部 PostgreSQL 或进行生产部署时，必须配置以下变量：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | 运行时 PostgreSQL 池化连接字符串；Serverless 不应使用直连地址 |
| `DIRECT_DATABASE_URL` | Prisma 迁移使用的数据库直连地址 |
| `DATABASE_POOL_MAX` | 单个函数实例的连接池上限，默认 `3`、最大 `10` |
| `ADMIN_USERNAME` | 管理员账号 |
| `ADMIN_PASSWORD_HASH` | 管理员密码的 bcrypt Hash |
| `JWT_SECRET` | JWT 签名密钥，至少 32 个字符 |
| `ADMIN_API_TOKEN` | 可选，Agent/CLI 管理 API 使用的随机 Bearer Token，至少 32 个字符 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile 公开站点密钥 |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile 服务端密钥，不得暴露给浏览器 |
| `TURNSTILE_ALLOWED_HOSTNAMES` | 可选，逗号分隔的 Siteverify 主机名白名单 |
| `TRUST_PROXY_HEADERS` | 只有反向代理会清洗并重写来源 IP 请求头时才设为 `true` |
| `CRON_SECRET` | Vercel Cron 调用批量监控接口的随机密钥，至少 16 个字符 |

生成密码 Hash：

```bash
node scripts/generate-password.mjs '你的强密码'
```

生成 JWT 随机密钥：

```bash
openssl rand -base64 48
```

如需让 Agent 或 CLI 绕开交互式登录、直接调用管理 API，生成独立 Token 并仅保存到服务端 Secret：

```bash
openssl rand -hex 32
```

将结果配置为 `ADMIN_API_TOKEN`。调用方通过 `Authorization: Bearer <token>` 访问管理接口；不要使用 `NEXT_PUBLIC_` 前缀，也不要把 Token 写入仓库、日志或命令行参数。更换环境变量并重新部署即可撤销旧 Token。

在 Cloudflare 控制台创建 Managed Turnstile Widget，将正式域名加入 Hostname Management，再把站点密钥与服务端密钥写入生产环境。官方测试密钥只由 `npm run dev` 在未配置密钥时自动使用，生产环境会拒绝测试密钥。

在 Vercel 等 Serverless 环境中，`DATABASE_URL` 必须使用数据库提供商给出的池化运行时地址；Prisma Postgres 对应 `pooled.db.prisma.io`。`DIRECT_DATABASE_URL` 保留直连地址，仅供 `prisma migrate deploy` 等 CLI 操作。不要把 `prisma+postgres://` Accelerate 地址传给当前的 `PrismaPg` 适配器。

`vercel.json` 默认每天 03:00 UTC 调用一次服务器批量探测，兼容 Vercel Hobby 套餐。配置 `CRON_SECRET` 后 Vercel 会以 Bearer Token 调用受保护接口；Pro 套餐如需更高频率，可以调整 cron 表达式。

应用默认使用 TCP 连接地址做登录限流。如果部署在 Nginx、Cloudflare 或托管平台之后，确认公网无法绕过代理直连源站，并由代理删除访客传入的 `CF-Connecting-IP`、`X-Real-IP`、`X-Forwarded-For` 后，再设置 `TRUST_PROXY_HEADERS=true`；否则攻击者可能伪造来源 IP 绕过限流。

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
- 首页会从当前浏览器直接向目标发送 `no-cors` 请求，用于判断用户所在网络是否可达；结果只保存在该浏览器的 `localStorage`，不会写入数据库。
- 跨域浏览器探测无法读取真实 HTTP 状态码，因此“可访问”表示请求可达，不等同于 HTTP 2xx；探测目标也会看到用户的出口 IP。
- 对私网 IP、`.local` 和 localhost，页面会遵循浏览器的 Local Network Access 权限：后台刷新不会主动弹框，用户点击检测时才会请求授权。生产环境必须使用 HTTPS；未获授权、非安全上下文或不支持该能力的浏览器可能无法探测 HTTP 内网地址。
- 公开首页不会触发服务器侧探测，只读取 PostgreSQL 中最近一次服务器结果，避免访客造成函数和数据库请求风暴。
- Vercel Cron 通过受保护的 `/api/monitor/run` 批量探测，固定并发为 4；管理员新增或编辑站点时可通过 `/api/monitor/check` 立即检测单站。
- 服务端会拒绝本机、私网、保留地址、非标准端口和不安全重定向，并在 IPv4/IPv6 公网地址之间回退；状态、检测时间和延迟写回 PostgreSQL。
- 管理写接口要求有效的 JWT HttpOnly Cookie，或 `ADMIN_API_TOKEN` 对应的 Bearer Token。
- 语言偏好保存在浏览器；主题配置保存在数据库并对所有访客生效。

## API

- `POST /api/auth/login`：管理员登录
- `POST /api/auth/logout`：退出登录
- `GET /api/auth/me`：读取当前登录状态
- `GET|POST /api/sites`：读取或新增网站
- `PUT|DELETE /api/sites/:id`：编辑或删除网站
- `POST /api/sites/import`：导入网站
- `GET|POST /api/categories`：读取或新增分类
- `PUT|DELETE /api/categories/:id`：编辑或删除分类
- `GET|POST /api/config/theme`：读取或修改主题
- `POST /api/monitor/check`：管理员检测单个已配置网站，Body 为 `{ "id": "站点 ID" }`
- `GET|POST /api/monitor/run`：Cron Bearer Token 或管理员鉴权后的限并发批量检测
- `GET /api/debug`：管理员鉴权后的数量诊断信息

## 安全边界

- 服务器侧只监控公网 HTTP/HTTPS 地址，并固定使用 80/443 端口；浏览器侧探测遵循访客自身网络与浏览器安全策略。
- DNS 解析结果和每次重定向都会重新校验；连接固定到已校验的 IP，避免 DNS 重绑定。
- 公开访客不能触发服务器出站请求；单站检测要求管理员会话或管理 API Token，批量检测还支持独立的 Cron Bearer Token。
- 密码 Hash、JWT 密钥、管理 API Token 和 Turnstile 服务端密钥仅从服务端环境变量读取。
- 登录接口始终通过 Cloudflare Siteverify 验证 Turnstile 令牌，并校验 action；正式环境还可通过 `TURNSTILE_ALLOWED_HOSTNAMES` 校验主机名。
- Turnstile 令牌只能使用一次且五分钟后过期；失败登录会重置挑战。
- 登录失败按哈希后的客户端 IP 写入 PostgreSQL：15 分钟内失败 5 次后暂停 15 分钟，数据库中不保存原始 IP。
- 生产环境请使用 HTTPS，并将数据库与密钥交给部署平台的 Secret 管理能力。
