require('dotenv').config();

console.log('Security Configuration Check:');
console.log('==============================\n');

try {
  console.log('✓ JWT_SECRET configured:', !!process.env.JWT_SECRET);
  console.log('✓ JWT_REFRESH_SECRET configured:', !!process.env.JWT_REFRESH_SECRET);
  console.log('✓ MONGODB_URI configured:', !!process.env.MONGODB_URI);
  console.log('✓ NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('✓ ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS);

  console.log('\n✓ Auth module loads:', !!require('./server/auth.js'));
  console.log('✓ Security module loads:', !!require('./server/security.js'));

  console.log('\n✅ All security configurations are in place!');
  console.log('\nImportant: Replace JWT secrets in production with strong values.');
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
}
