// Run with: node server/scripts/migrateBankCategories.js
const connectDB = require('../database');
const { BankTransaction } = require('../models');

async function inferCategory(tx) {
  const desc = (tx.description || '').toLowerCase();
  if (desc.includes('opening')) return 'OPENING';
  if (desc.includes('upi')) return 'UPI';
  if (desc.includes('supplier')) return 'SUPPLIER';
  if (tx.type === 'OUT') return 'EXPENSE';
  return 'OTHER';
}

async function run() {
  await connectDB();
  console.log('Connected to DB — running BankTransaction category migration');
  const txs = await BankTransaction.find();
  let updated = 0;
  for (const tx of txs) {
    if (!tx.category || tx.category === 'OTHER') {
      const newCat = inferCategory(tx);
      if (newCat !== (tx.category || '')) {
        await BankTransaction.updateOne({ id: tx.id }, { $set: { category: newCat } });
        updated++;
        console.log(`Updated tx ${tx.id}: category -> ${newCat}`);
      }
    }
  }
  console.log(`Migration complete. Updated ${updated} transactions.`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
