# 快速启动

## 1. 使用受支持的 Node.js

```bash
nvm use
```

项目固定使用 Node.js 22.12–22.x。Node 23 不在 Prisma 7 的支持范围内。

## 2. 安装依赖

```bash
npm install
```

## 3. 本地直接启动

```bash
npm run dev
```

没有 `.env.local` 或 `DATABASE_URL` 时，项目会自动：

1. 在 `data/pglite` 启动持久化本地数据库；
2. 应用已有 Prisma 迁移；
3. 首次启动时生成本地管理员密码和安全密钥；
4. 启动 Next.js。

管理员账号与随机密码会显示在终端中，并保存在已被 Git 忽略的 `data/dev-credentials.json`，后续重启仍可使用同一密码。停止开发服务时，本地数据库服务会自动关闭。

访问 [http://localhost:3000](http://localhost:3000)。

## 4. 使用外部 PostgreSQL

```bash
cp .env.sample .env.local
node scripts/generate-password.mjs '你的强密码'
openssl rand -base64 48
```

编辑 `.env.local`，填写池化 `DATABASE_URL`、迁移专用 `DIRECT_DATABASE_URL`、管理员账号、密码 Hash、JWT 随机密钥，以及 Cloudflare Turnstile 的站点密钥和服务端密钥。Vercel 部署还需要至少 16 个字符的 `CRON_SECRET`。配置 `DATABASE_URL` 后，`npm run dev` 会使用该数据库并自动应用迁移，不再启动本地 PGlite；未配置 Turnstile 密钥的本地开发会自动使用官方测试密钥。

也可以手动初始化外部数据库：

```bash
npm run db:deploy
```

只启动 Next.js、不自动启动数据库或执行迁移：

```bash
npm run dev:next
```

完整部署、迁移和安全说明见 `README.md`。

## 5. 使用 Docker 部署

项目包含多阶段 `Dockerfile`（基于 Next.js standalone 输出）与 `docker-compose.yml`（app + PostgreSQL 16）。

```bash
cp .env.docker.sample .env
# 编辑 .env，至少设置 DB_PASSWORD、ADMIN_PASSWORD_HASH、JWT_SECRET
docker compose up -d --build
```

首次启动时容器会自动执行 `prisma migrate deploy` 应用迁移，然后启动 Next.js。访问 [http://localhost:3000](http://localhost:3000)。

- 数据库数据持久化在命名卷 `db-data` 中。
- 如已有外部 PostgreSQL，可只用 Dockerfile 构建镜像，通过环境变量注入 `DATABASE_URL` 运行。
- 经过反向代理（Nginx/Caddy）时，把 `.env` 中的 `TRUST_PROXY_HEADERS` 设为 `true`。
