const connectDB = require('../database');
const {
  Product, Stock, Sale, Expense, Customer, CustomerPayment,
  Supplier, SupplierPayment, CashAdjustment, BankAccount, BankTransaction
} = require('../models');

async function clear() {
  try {
    await connectDB();
    console.log('Connected to DB — clearing selected collections...');

    // WARNING: destructive operations. This script DOES NOT remove Users.
    const collections = [
      { name: 'products', model: Product },
      { name: 'stock', model: Stock },
      { name: 'sales', model: Sale },
      { name: 'expenses', model: Expense },
      { name: 'customers', model: Customer },
      { name: 'customerPayments', model: CustomerPayment },
      { name: 'suppliers', model: Supplier },
      { name: 'supplierPayments', model: SupplierPayment },
      { name: 'cashAdjustments', model: CashAdjustment },
      { name: 'bankAccounts', model: BankAccount },
      { name: 'bankTransactions', model: BankTransaction }
    ];

    for (const c of collections) {
      try {
        await c.model.deleteMany({});
        console.log(`Cleared ${c.name}`);
      } catch (e) {
        console.warn(`Failed to clear ${c.name}:`, e.message || e);
      }
    }

    console.log('Finished clearing selected collections. Users were NOT removed.');
    process.exit(0);
  } catch (e) {
    console.error('Clear DB error', e);
    process.exit(1);
  }
}

if (require.main === module) {
  console.log('\n*** CLEAR DB SCRIPT ***');
  console.log('This will delete data from many collections but will keep Users.');
  console.log('To run, set MONGO_URI in your environment and confirm.');
  clear();
}
