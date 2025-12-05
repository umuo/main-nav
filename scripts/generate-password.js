const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'admin123';
const hash = bcrypt.hashSync(password, 10);

console.log('\n密码:', password);
console.log('Hash (原始):', hash);

// Escape $ for dotenv
const escapedHash = hash.replace(/\$/g, '\\$');

console.log('\n请将以下内容配置到 .env.local (注意 $ 符号已转义，这是 Next.js 环境变量的要求):');
console.log(`ADMIN_PASSWORD_HASH='${escapedHash}'\n`);
