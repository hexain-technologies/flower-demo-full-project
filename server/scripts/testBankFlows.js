// Run with: node server/scripts/testBankFlows.js
// Requires the server to be running on http://localhost:3001

const fetch = global.fetch || require('node-fetch');

async function run() {
  const base = 'http://localhost:3001';
  const id = 'tf-' + Math.random().toString(36).substr(2,6);
  const acc = { id: id, name: 'TF Bank ' + id, accountNumber: 'TF' + id, ifsc: 'TF000', balance: 1000 };

  // create bank account
  let res = await fetch(base + '/api/bank-accounts', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(acc) });
  if (!res.ok) throw new Error('Failed to create bank account');
  console.log('Created bank account', acc.id);

  // create UPI sale
  const sale = { id: 'sale-' + id, date: new Date().toISOString(), subTotal:200, discount:0, totalAmount:200, amountPaid:200, changeReturned:0, paymentMode:'UPI', bankAccountId: acc.id, customerName:'Test', createdBy:'tester', items:[{ stockBatchId:'x', productId:'p', productName:'Test', quantity:1, price:200, status:'NEW' }] };
  res = await fetch(base + '/api/sales', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(sale) });
  if (!res.ok) throw new Error('Failed to create UPI sale');
  console.log('Created UPI sale');

  // create expense via bank
  const exp = { id: 'exp-' + id, category: 'Misc', amount: 50, description:'Office', date: new Date().toISOString(), paymentMode: 'BANK', bankAccountId: acc.id, createdBy:'tester' };
  res = await fetch(base + '/api/expenses', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(exp) });
  if (!res.ok) throw new Error('Failed to create expense');
  console.log('Created bank expense');

  // create supplier payment via bank
  const pay = { id: 'pay-' + id, supplierId: 's-test', amount: 30, date: new Date().toISOString(), note:'Supplies', paymentMode:'BANK', bankAccountId: acc.id, createdBy:'tester' };
  res = await fetch(base + '/api/supplier-payments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(pay) });
  if (!res.ok) throw new Error('Failed to create supplier payment');
  console.log('Created supplier payment');

  // fetch summary
  res = await fetch(base + '/api/bank-summary');
  if (!res.ok) throw new Error('Failed to fetch bank summary');
  const summary = await res.json();
  console.log('Bank summary:', JSON.stringify(summary, null, 2));

  // Quick assertions
  const accEntry = summary.perAccount.find(a => a.bankAccountId === acc.id);
  if (!accEntry) throw new Error('Per-account entry missing');
  if (accEntry.upiIn !== 200) throw new Error('UPI not credited correctly');
  if (accEntry.expensesOut !== 50) throw new Error('Expense not recorded');
  if (accEntry.supplierOut !== 30) throw new Error('Supplier payment not recorded');

  console.log('TEST PASSED');
}

run().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
