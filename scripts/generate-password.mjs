import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password || password.length < 12) {
    console.error('用法: node scripts/generate-password.mjs "至少 12 个字符的强密码"');
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
const escapedHash = hash.replace(/\$/g, '\\$');

console.log('\n请将以下内容配置到 .env.local：');
console.log(`ADMIN_PASSWORD_HASH='${escapedHash}'\n`);
