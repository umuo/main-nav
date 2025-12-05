const bcrypt = require('bcryptjs');

const hash = '$2a$10$o32YRX3kfcC4mgmHVewr/.cMWj5EORQGWA.mvswBOdpZ65tzmcFze';
const testPassword = process.argv[2] || 'admin123';

console.log('\n测试密码验证:');
console.log('Hash:', hash);
console.log('测试密码:', testPassword);
console.log('验证结果:', bcrypt.compareSync(testPassword, hash));

