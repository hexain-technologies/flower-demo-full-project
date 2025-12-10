const path = require('path');
const fs = require('fs');

console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);
console.log('Node env:', process.env.NODE_ENV);

console.log('Checking imports...');
try {
  console.log('1. require dotenv...');
  require('dotenv').config();
  console.log('   ✓ dotenv loaded');
  
  console.log('2. require express...');
  const express = require('express');
  console.log('   ✓ express loaded');
  
  console.log('3. require cors...');
  const cors = require('cors');
  console.log('   ✓ cors loaded');
  
  console.log('4. require database...');
  const connectDB = require('./database');
  console.log('   ✓ database loaded');
  
  console.log('5. require models...');
  const models = require('./models');
  console.log('   ✓ models loaded:', Object.keys(models));
  
  console.log('\nAll imports successful! Starting server...');
  require('./index.js');
  
} catch (err) {
  console.error('Error during import:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
}
