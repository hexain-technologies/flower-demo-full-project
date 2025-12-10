// Run with: node server/scripts/testDaybookDuplicates.js
// Requires the server to be running on http://localhost:3001

const fetch = global.fetch || require('node-fetch');

const base = 'http://localhost:3001';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(path, body) {
  const res = await fetch(base + path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return await res.json();
}

async function get(path) {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return await res.json();
}

async function run() {
  console.log('Test: Daybook duplicates');

  // Create two suppliers
  const sup1 = { id: 'sup1-' + Math.random().toString(36).slice(2,8), name: 'new sup 1', contact: '111', outstandingBalance: 0 };
  const sup2 = { id: 'sup2-' + Math.random().toString(36).slice(2,8), name: 'new sup 2', contact: '222', outstandingBalance: 0 };
  await post('/api/suppliers', sup1);
  await post('/api/suppliers', sup2);
  console.log('Created suppliers', sup1.id, sup2.id);

  // Purchase Invoice 01 (single batch) from sup1: 20 items @12 => 240
  const batch1 = {
    id: 'b1-' + Math.random().toString(36).slice(2,8),
    productId: 'p-rose', productName: 'Red Rose', quantity: 20, originalQuantity: 20,
    purchasePrice: 12, sellingPrice: 20, purchaseDate: new Date().toISOString().split('T')[0],
    supplierId: sup1.id, supplierName: sup1.name, paymentStatus: 'PAID', invoiceNo: '01'
  };
  await post('/api/stock', batch1);
  console.log('Created purchase batch1 invoice 01 ->', batch1.id);

  // Purchase Invoice 25: simulate two item-wise batches (previous buggy case) from sup2
  // Batch A
  const batch2a = {
    id: 'b2a-' + Math.random().toString(36).slice(2,8),
    productId: 'p-lily', productName: 'White Lily', quantity: 10, originalQuantity: 10,
    purchasePrice: 10, sellingPrice: 18, purchaseDate: new Date().toISOString().split('T')[0],
    supplierId: sup2.id, supplierName: sup2.name, paymentStatus: 'PAID', invoiceNo: '25'
  };
  // Batch B
  const batch2b = {
    id: 'b2b-' + Math.random().toString(36).slice(2,8),
    productId: 'p-lotus', productName: 'Lotus', quantity: 14, originalQuantity: 14,
    purchasePrice: 24, sellingPrice: 40, purchaseDate: new Date().toISOString().split('T')[0],
    supplierId: sup2.id, supplierName: sup2.name, paymentStatus: 'PAID', invoiceNo: '25'
  };
  await post('/api/stock', batch2a);
  await post('/api/stock', batch2b);
  console.log('Created purchase batches for invoice 25 ->', batch2a.id, batch2b.id);

  // Create Supplier Payment for invoice 25 (payment at purchase time). Amount equals total of both batches.
  const total25 = (batch2a.originalQuantity * batch2a.purchasePrice) + (batch2b.originalQuantity * batch2b.purchasePrice);
  const pay25 = {
    id: 'pay25-' + Math.random().toString(36).slice(2,8),
    supplierId: sup2.id,
    amount: total25,
    date: new Date().toISOString().split('T')[0],
    note: 'Purchase Payment for invoice 25',
    paymentMode: 'CASH'
  };
  await post('/api/supplier-payments', pay25);
  console.log('Created supplier payment for invoice 25 ->', pay25.id, 'amount', total25);

  // Small delay to let server process and for ordering
  await sleep(500);

  // Fetch data used by Day Book
  const [sales, expenses, supplierPayments, cashAdjustments, stock, bankTransactions] = await Promise.all([
    get('/api/sales'),
    get('/api/expenses'),
    get('/api/supplier-payments'),
    get('/api/cash-adjustments'),
    get('/api/stock'),
    get('/api/bank-transactions')
  ]);

  // Recreate the frontend daybook calculation (simplified for this test range = today)
  const today = new Date().toISOString().split('T')[0];
  const isWithinDate = (d) => { const ds = d.includes('T') ? d.split('T')[0] : d; return ds === today; };
  const isBeforeDate = (d) => { const ds = d.includes('T') ? d.split('T')[0] : d; return ds < today; };

  let openingBalance = 0;
  sales.filter(s => isBeforeDate(s.date)).forEach(s => openingBalance += s.amountPaid);
  expenses.filter(e => isBeforeDate(e.date)).forEach(e => openingBalance -= e.amount);
  supplierPayments.filter(p => isBeforeDate(p.date)).forEach(p => openingBalance -= p.amount);
  cashAdjustments.filter(c => isBeforeDate(c.date)).forEach(c => openingBalance += (c.type === 'ADD' ? c.amount : -c.amount));
  bankTransactions.filter(bt => isBeforeDate(bt.date)).forEach(bt => openingBalance += (bt.type === 'IN' ? bt.amount : -bt.amount));

  const entries = [];
  // purchases grouping
  const filteredPurchases = stock.filter(b => isWithinDate(b.purchaseDate));
  const purchaseGroups = {};
  filteredPurchases.forEach(b => {
    const key = b.invoiceNo && b.invoiceNo.trim() !== '' ? `INV::${b.invoiceNo}` : `SUP::${b.supplierId || 'unknown'}::${b.purchaseDate}`;
    const amt = (b.originalQuantity || b.quantity || 0) * (b.purchasePrice || 0);
    if (!purchaseGroups[key]) purchaseGroups[key] = { date: b.purchaseDate, supplierName: b.supplierName, totalAmount: 0, itemsCount:0, invoiceNo: b.invoiceNo };
    purchaseGroups[key].totalAmount += amt;
    purchaseGroups[key].itemsCount += (b.originalQuantity || b.quantity || 0);
  });
  Object.keys(purchaseGroups).forEach(k => {
    const g = purchaseGroups[k];
    const desc = g.invoiceNo ? `Purchase Invoice: ${g.invoiceNo} (${g.itemsCount} items) from ${g.supplierName || 'Supplier'}` : `Purchase: ${g.supplierName || 'Supplier'} (${g.itemsCount} items)`;
    entries.push({ date: g.date, desc, category: 'PURCHASE', credit: 0, debit: g.totalAmount });
  });

  // expenses
  expenses.filter(e => isWithinDate(e.date)).forEach(e => entries.push({ date: e.date, desc: `Exp: ${e.category} - ${e.description}`, category: 'EXPENSE', credit:0, debit: e.amount }));

  // supplier payments
  supplierPayments.filter(p => isWithinDate(p.date)).forEach(p => entries.push({ date: p.date, desc: `Supplier Pay: ${p.note || 'Payment'}`, category: 'PAYMENT', credit:0, debit: p.amount }));

  // bank txns excluding supplier to avoid dup
  bankTransactions.filter(bt => isWithinDate(bt.date) && ((bt.category||'').toUpperCase() !== 'SUPPLIER')).forEach(bt => entries.push({ date: bt.date, desc: `${bt.description||'Bank Txn'} (Bank)`, category: 'BANK', credit: bt.type === 'IN' ? bt.amount : 0, debit: bt.type === 'OUT' ? bt.amount : 0 }));

  // dedupe
  const seen = new Set();
  const unique = [];
  const normalize = s => (s||'').toString().replace(/\s+/g,' ').trim().toLowerCase();
  for (const e of entries) {
    const key = `${(e.date||'').split('T')[0]}|${(e.category||'').toString().toUpperCase()}|${(e.credit||0).toFixed(2)}|${(e.debit||0).toFixed(2)}|${normalize(e.desc)}`;
    if (!seen.has(key)) { seen.add(key); unique.push(e); }
  }

  // sort and running balance
  unique.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = openingBalance;
  console.log('\nDay Book Entries:');
  for (const e of unique) {
    running = running + (e.credit||0) - (e.debit||0);
    console.log(`${e.date}\t${e.desc}\t${e.category}\t-\t₹${(e.debit||e.credit||0).toFixed(2)}\t₹${running.toFixed(2)}`);
  }

  console.log('\nTest complete');
}

run().catch(err => { console.error('ERROR', err); process.exit(1); });
