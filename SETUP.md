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
