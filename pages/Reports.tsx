
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../context/StoreContext';
import { StockBatch } from '../types';
import { BankAccount } from '../types';
import { Calendar, TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, BookOpen, PlusCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

export const Reports = () => {
  const { sales, expenses, stock, supplierPayments, cashAdjustments, addCashAdjustment, userName, bankAccounts, bankTransactions, addBankTransaction, addBankAccount } = useStore();
  const { updateBankAccount } = useStore();
  const [showBankOBModal, setShowBankOBModal] = useState(false);
  const [bankObAmount, setBankObAmount] = useState('');
  const [bankObAccountId, setBankObAccountId] = useState('');
  const [activeTab, setActiveTab] = useState<'SALES' | 'PURCHASE' | 'EXPENSE' | 'PROFIT' | 'DAYBOOK' | 'BANK'>('SALES');
  const [showAllBankTx, setShowAllBankTx] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccIfsc, setNewAccIfsc] = useState('');
  const [newAccOpening, setNewAccOpening] = useState('');
  // Extend activeTab union to include BANK via runtime cast when switching tabs
  
  // Opening Balance Modal State
  const [showOBModal, setShowOBModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
  const [bankFilter, setBankFilter] = useState<string>('ALL');
  const [obAmount, setObAmount] = useState('');
  
  // Date Helpers (Local Time)
  const getLocalDateStr = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const today = new Date();

  // Default to today only (can use date pickers to view past ranges)
  const [startDate, setStartDate] = useState(getLocalDateStr(today));
  const [endDate, setEndDate] = useState(getLocalDateStr(today));

  // --- Filtering Helpers ---
  const isWithinDate = (dateStr: string) => {
    if (!dateStr) return false;
    // Handle both ISO strings (2023-11-02T...) and simple dates (2023-11-02)
    const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return d >= startDate && d <= endDate;
  };

  const isBeforeDate = (dateStr: string) => {
    if (!dateStr) return false;
    const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return d < startDate;
  };

  // --- Derived Data ---
  const filteredSales = sales.filter(s => isWithinDate(s.date));
  const filteredPurchases = stock.filter(b => isWithinDate(b.purchaseDate));
  const filteredExpenses = expenses.filter(e => isWithinDate(e.date));

  // --- Totals for Standard Tabs ---
  const totalSalesVal = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalPurchaseVal = filteredPurchases.reduce((acc, b) => acc + (b.quantity * b.purchasePrice), 0);
  const totalExpenseVal = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);

  // --- Daybook Logic ---
  const calculateDaybook = () => {
    // 1. Calculate Opening Balance (Net Flow before Start Date)
    // Formula: Sales - (Purchases + Expenses + SupplierPayments) + CashAdjustments
    let openingBalance = 0;
    
    // Previous Cash flows
    sales.filter(s => isBeforeDate(s.date)).forEach(s => openingBalance += s.amountPaid); // Cash inflow only
    expenses.filter(e => isBeforeDate(e.date)).forEach(e => openingBalance -= e.amount);
    supplierPayments.filter(p => isBeforeDate(p.date) && !p.hideFromDaybook).forEach(p => openingBalance -= p.amount);
    cashAdjustments.filter(c => isBeforeDate(c.date)).forEach(c => {
       openingBalance += (c.type === 'ADD' ? c.amount : -c.amount);
    });
     // Include bank transactions before start date
     (bankTransactions || []).filter(bt => isBeforeDate(bt.date)).forEach(bt => {
       openingBalance += (bt.type === 'IN' ? bt.amount : -bt.amount);
     });

    // 2. Gather Ledger Entries for the period
    const entries: any[] = [];

    // Sales (Only Paid amount affects cashbook strictly, but daybook often shows total. 
    // For strict cash flow, we use amountPaid. If user wants Accrual, use totalAmount.
    // Given the request for "Cash Add by Admin", implies Cashbook.
    // Using actual cash inflow here)
    filteredSales.forEach(s => {
       if (s.amountPaid > 0) {
         entries.push({
            date: s.date,
            desc: `Sale #${s.id.substr(0, 6)} (${s.customerName || 'Walk-in'})`,
            type: 'INCOME',
            category: 'SALE',
            credit: s.amountPaid,
            debit: 0
         });
       }
    });

      // Purchases: Show one entry per purchase bill (group by invoiceNo when available,
      // otherwise group by supplier + date)
      const purchaseGroups: Record<string, { date: string; supplierName?: string; totalAmount: number; itemsCount: number; invoiceNo?: string }> = {};
      filteredPurchases
        .filter(b => b.paymentStatus === 'PAID' || b.paymentStatus === 'CREDIT')
        .forEach(batch => {
          const key = batch.invoiceNo && batch.invoiceNo.trim() !== '' ? `INV::${batch.invoiceNo}` : `SUP::${batch.supplierId || 'unknown'}::${batch.purchaseDate}`;
          const amt = (batch.originalQuantity || batch.quantity || 0) * (batch.purchasePrice || 0);
          if (!purchaseGroups[key]) {
            purchaseGroups[key] = { date: batch.purchaseDate, supplierName: batch.supplierName, totalAmount: 0, itemsCount: 0, invoiceNo: batch.invoiceNo };
          }
          purchaseGroups[key].totalAmount += amt;
          purchaseGroups[key].itemsCount += (batch.originalQuantity || batch.quantity || 0);
        });

      Object.keys(purchaseGroups).forEach(k => {
        const g = purchaseGroups[k];
        const desc = g.invoiceNo ? `Purchase Invoice: ${g.invoiceNo} (${g.itemsCount} items) from ${g.supplierName || 'Supplier'}` : `Purchase: ${g.supplierName || 'Supplier'} (${g.itemsCount} items)`;
        // Purchases should appear in Day Book for record only and NOT affect running balance
        entries.push({
          date: g.date,
          desc,
          type: 'EXPENSE',
          category: 'PURCHASE',
          credit: 0,
          debit: 0,
          // keep original amount for display if needed
          recordedAmount: g.totalAmount
        });
      });

    filteredExpenses.forEach(e => entries.push({
      date: e.date,
      desc: `Exp: ${e.category} - ${e.description}`,
      type: 'EXPENSE',
      category: 'EXPENSE',
      credit: 0,
      debit: e.amount
    }));

    supplierPayments.filter(p => isWithinDate(p.date) && !p.hideFromDaybook).forEach(p => entries.push({
      date: p.date,
      desc: `Supplier Pay: ${p.note || 'Payment'}`,
      type: 'EXPENSE',
      category: 'PAYMENT',
      credit: 0,
      debit: p.amount
    }));

    cashAdjustments.filter(c => isWithinDate(c.date)).forEach(c => entries.push({
       date: c.date,
       desc: `${c.description} (Admin: ${c.createdBy})`,
       type: c.type === 'ADD' ? 'INCOME' : 'EXPENSE',
       category: 'ADJUSTMENT',
       credit: c.type === 'ADD' ? c.amount : 0,
       debit: c.type === 'REMOVE' ? c.amount : 0
    }));

     // Bank transactions in period — exclude supplier-related bank txns to avoid duplicate Day Book entries
     (bankTransactions || []).filter(bt => isWithinDate(bt.date) && (bt.category || '').toUpperCase() !== 'SUPPLIER').forEach(bt => entries.push({
       date: bt.date,
       desc: `${bt.description || 'Bank Txn'} (Bank)`,
       type: bt.type === 'IN' ? 'INCOME' : 'EXPENSE',
       category: 'BANK',
       credit: bt.type === 'IN' ? bt.amount : 0,
       debit: bt.type === 'OUT' ? bt.amount : 0
     }));

    // De-duplicate entries that are effectively the same (prevents double-counting)
    const seen = new Set();
    const uniqueEntries: any[] = [];
    const normalizeDesc = (d: string) => (d || '').toString().replace(/\s+/g, ' ').trim().toLowerCase();
    for (const e of entries) {
      const key = `${(e.date||'').split('T')[0]}|${(e.category||'').toString().toUpperCase()}|${(e.credit||0).toFixed(2)}|${(e.debit||0).toFixed(2)}|${normalizeDesc(e.desc)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEntries.push(e);
      }
    }

    // Sort chronologically
    uniqueEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = openingBalance;
    const entriesWithBalance = uniqueEntries.map(entry => {
      runningBalance = runningBalance + entry.credit - entry.debit;
      return { ...entry, balance: runningBalance };
    });

    return { openingBalance, entries: entriesWithBalance, closingBalance: runningBalance };
  };

  const daybook = calculateDaybook();

  const handleAddOpeningBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!obAmount) return;
    
    addCashAdjustment({
      id: uuidv4(),
      amount: Number(obAmount),
      date: new Date().toISOString(),
      description: 'Opening Balance / Cash In',
      type: 'ADD',
      createdBy: userName
    });
    
    setObAmount('');
    setShowOBModal(false);
  };

  // --- Profit & Loss Calculation ---

  // --- Updated Profit & Loss Calculation ---
  const calculatePL = () => {
    // Formula: Net Profit = Total Sales - Total Purchases - Expenses - Damage
    const revenue = totalSalesVal;
    const totalPurchases = totalPurchaseVal;
    const totalExpenses = totalExpenseVal;
    let damageLoss = 0;

    stock.forEach(batch => {
      const pDate = new Date(batch.purchaseDate);
      const damageDate = new Date(pDate);
      damageDate.setDate(pDate.getDate() + 2);
      const dDateStr = getLocalDateStr(damageDate);
      if (dDateStr >= startDate && dDateStr <= endDate) {
        if (batch.quantity > 0) {
          damageLoss += batch.quantity * batch.purchasePrice;
        }
      }
    });

    const netProfit = revenue - totalPurchases - totalExpenses - damageLoss;

    return { revenue, totalPurchases, totalExpenses, damageLoss, netProfit };
  };

  const pl = calculatePL();

  const plChartData = [
    { name: 'Revenue', amount: pl.revenue, fill: '#10b981' },
    { name: 'Purchases', amount: pl.totalPurchases, fill: '#f59e0b' },
    { name: 'Expenses', amount: pl.totalExpenses, fill: '#ef4444' },
    { name: 'Damage', amount: pl.damageLoss, fill: '#7f1d1d' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Advanced Reports</h2>
        
        {/* Date Filter Bar */}
        <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-2 items-center">
          <Calendar size={16} className="text-gray-500 ml-2" />
          <input 
            type="date" 
            className="border-none outline-none text-sm bg-transparent"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <span className="text-gray-400">-</span>
          <input 
            type="date" 
            className="border-none outline-none text-sm bg-transparent"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-6 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('SALES')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'SALES' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'}`}
        >
          Sales
        </button>
        <button 
          onClick={() => setActiveTab('PURCHASE')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'PURCHASE' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'}`}
        >
          Purchases
        </button>
        <button 
          onClick={() => setActiveTab('EXPENSE')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'EXPENSE' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'}`}
        >
          Expenses
        </button>
        <button 
          onClick={() => setActiveTab('DAYBOOK')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'DAYBOOK' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'}`}
        >
          <BookOpen size={14} /> Day Book
        </button>
        <button 
          onClick={() => setActiveTab('BANK' as any)}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'BANK' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'}`}
        >
          <TrendingUp size={14} /> Bank
        </button>
        <button 
          onClick={() => setActiveTab('PROFIT')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'PROFIT' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'}`}
        >
          <DollarSign size={14} /> Profit & Loss
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {/* Add Account Modal (global) */}
        {showAddAccountModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="p-4 border-b">
                <h3 className="text-lg font-bold">Add Bank Account</h3>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  console.log('Reports: submit Add Account', { newAccName, newAccNumber, newAccIfsc, newAccOpening });
                  if (!newAccName) return;
                  const accId = uuidv4();
                  const account = {
                    id: accId,
                    name: newAccName,
                    accountNumber: newAccNumber,
                    ifsc: newAccIfsc,
                    balance: Number(newAccOpening) || 0
                  };
                  await addBankAccount(account as any);
                  if (Number(newAccOpening) > 0) {
                    await addBankTransaction({
                      id: uuidv4(),
                      bankAccountId: accId,
                      amount: Number(newAccOpening),
                      type: 'IN',
                      date: new Date().toISOString(),
                      description: 'Opening Balance',
                      createdBy: userName
                    } as any);
                  }
                  setNewAccName(''); setNewAccNumber(''); setNewAccIfsc(''); setNewAccOpening(''); setShowAddAccountModal(false);
                  try { window.alert('Bank account added'); } catch {}
                } catch (err) {
                  console.error('Add account error', err);
                  try { window.alert('Failed to add account: ' + (err && (err as any).message ? (err as any).message : err)); } catch {}
                }
              }} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                  <input className="w-full border p-2 rounded-lg" value={newAccName} onChange={e => setNewAccName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input className="w-full border p-2 rounded-lg" value={newAccNumber} onChange={e => setNewAccNumber(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
                  <input className="w-full border p-2 rounded-lg" value={newAccIfsc} onChange={e => setNewAccIfsc(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (optional)</label>
                  <input type="number" className="w-full border p-2 rounded-lg" value={newAccOpening} onChange={e => setNewAccOpening(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAddAccountModal(false)} className="flex-1 py-2 border rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold">Add Account</button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* SALES TAB */}
        {activeTab === 'SALES' && (
          <>
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between">
               <h3 className="font-bold text-gray-700">Total Sales: ₹{totalSalesVal.toFixed(2)}</h3>
               <span className="text-xs text-gray-500">{filteredSales.length} Transactions</span>
            </div>

            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Mode</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="px-6 py-3">{sale.customerName || 'Walk-in'}</td>
                      <td className="px-6 py-3">
                         <span className={`px-2 py-0.5 rounded text-xs border ${sale.paymentMode === 'CREDIT' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                           {sale.paymentMode}
                         </span>
                      </td>
                      <td className="px-6 py-3 text-right font-medium">₹{sale.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {filteredSales.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-400">No sales in this period</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PURCHASE TAB */}
        {activeTab === 'PURCHASE' && (
           <>
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between">
               <h3 className="font-bold text-gray-700">Total Purchases: ₹{totalPurchaseVal.toFixed(2)}</h3>
               <span className="text-xs text-gray-500">{filteredPurchases.length} Batches</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Supplier</th>
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3">Qty</th>
                    <th className="px-6 py-3">Cost/Unit</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* Group purchases by supplier and date */}
                  {(() => {
                    interface GroupedBatch {
                      supplierName: string;
                      purchaseDate: string;
                      totalAmount: number;
                      items: StockBatch[];
                      status?: string;
                    }
                    const grouped: Record<string, GroupedBatch> = {};
                    filteredPurchases.forEach(batch => {
                      const key = `${batch.supplierName || 'Unknown'}|${batch.purchaseDate}`;
                      if (!grouped[key]) {
                        grouped[key] = {
                          supplierName: batch.supplierName || 'Unknown',
                          purchaseDate: batch.purchaseDate,
                          totalAmount: 0,
                          items: [],
                          status: batch.paymentStatus
                        };
                      }
                      grouped[key].totalAmount += batch.originalQuantity * batch.purchasePrice;
                      grouped[key].items.push(batch);
                    });
                    return Object.values(grouped).map((group: GroupedBatch, idx) => (
                      <tr key={group.supplierName + group.purchaseDate + idx} className="hover:bg-gray-50">
                        <td className="px-6 py-3">{group.purchaseDate}</td>
                        <td className="px-6 py-3 font-medium text-gray-900">{group.supplierName}</td>
                        <td className="px-6 py-3">{group.items.map(i => i.productName).join(', ')}</td>
                        <td className="px-6 py-3">{group.items.reduce((sum, i) => sum + i.originalQuantity, 0)}</td>
                        <td className="px-6 py-3">-</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${group.status === 'CREDIT' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>{group.status || 'PAID'}</span>
                        </td>
                        <td className="px-6 py-3 text-right font-medium">₹{group.totalAmount.toFixed(2)}</td>
                      </tr>
                    ));
                  })()}
                  {filteredPurchases.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-400">No purchases in this period</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* EXPENSE TAB */}
        {activeTab === 'EXPENSE' && (
           <>
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between">
               <h3 className="font-bold text-gray-700">Total Expenses: ₹{totalExpenseVal.toFixed(2)}</h3>
               <span className="text-xs text-gray-500">{filteredExpenses.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">{exp.date}</td>
                      <td className="px-6 py-3">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-semibold">{exp.category}</span>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{exp.description}</td>
                      <td className="px-6 py-3 text-right font-medium text-red-600">₹{exp.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-400">No expenses in this period</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* DAYBOOK TAB */}
        {activeTab === 'DAYBOOK' && (
           <>
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center flex-wrap gap-4">
               <div className="flex gap-8">
                  <div>
                     <p className="text-xs text-gray-500">Opening Balance</p>
                     <h3 className={`font-bold ${daybook.openingBalance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                        ₹{daybook.openingBalance.toFixed(2)}
                     </h3>
                  </div>
                  <div>
                     <p className="text-xs text-gray-500">Closing Balance</p>
                     <h3 className={`font-bold ${daybook.closingBalance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                        ₹{daybook.closingBalance.toFixed(2)}
                     </h3>
                  </div>
               </div>
               
               <button 
                  onClick={() => setShowOBModal(true)}
                  className="text-sm bg-pink-600 text-white px-3 py-2 rounded-lg hover:bg-pink-700 flex items-center gap-2"
               >
                  <PlusCircle size={16} /> Add Opening Balance
               </button>
              <button 
                onClick={() => { setShowBankOBModal(true); setBankObAccountId(bankAccounts && bankAccounts.length ? bankAccounts[0].id : ''); }}
                className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <PlusCircle size={16} /> Add Bank Opening
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Date/Time</th>
                    <th className="px-6 py-3">Particulars</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3 text-right text-green-600">Credit (+)</th>
                    <th className="px-6 py-3 text-right text-red-600">Debit (-)</th>
                    <th className="px-6 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {daybook.entries.length === 0 ? (
                     <tr><td colSpan={6} className="p-6 text-center text-gray-400">No transactions in this period</td></tr>
                  ) : (
                    daybook.entries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-3 whitespace-nowrap">
                          {entry.date.includes('T') ? new Date(entry.date).toLocaleString() : entry.date}
                        </td>
                        <td className="px-6 py-3">{entry.desc}</td>
                        <td className="px-6 py-3">
                          <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${entry.type === 'INCOME' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {entry.category}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right text-green-700 font-medium">
                          {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-6 py-3 text-right text-red-700 font-medium">
                          {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-6 py-3 text-right font-bold text-gray-700">
                          ₹{entry.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* BANK TAB */}
        {activeTab === 'BANK' && (
          <>
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center flex-wrap gap-4">
              <div className="flex gap-8 items-center">
                <div>
                  <p className="text-xs text-gray-500">Total Bank Balance</p>
                  <h3 className={`font-bold text-gray-800`}>₹{(bankFilter === 'ALL' ? ((bankAccounts || []).reduce((s, a) => s + (a.balance || 0), 0)) : ((bankAccounts || []).find(b => b.id === bankFilter)?.balance || 0)).toFixed(2)}</h3>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Accounts</p>
                  <h3 className="text-sm text-gray-700">{bankFilter === 'ALL' ? `${(bankAccounts || []).length} accounts` : ((bankAccounts || []).find(b => b.id === bankFilter)?.name || 'Account')}</h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Show</label>
                <button onClick={() => setShowAllBankTx(false)} className={`px-3 py-1 rounded-lg border ${!showAllBankTx ? 'bg-pink-600 text-white' : 'bg-white'}`}>This Range</button>
                <button onClick={() => setShowAllBankTx(true)} className={`px-3 py-1 rounded-lg border ${showAllBankTx ? 'bg-pink-600 text-white' : 'bg-white'}`}>All</button>
                <label className="text-sm text-gray-600">Account</label>
                <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="px-2 py-1 border rounded-md">
                  <option value="ALL">All</option>
                  {(bankAccounts || []).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => { console.log('Reports: open Add Account modal'); setShowAddAccountModal(true); }} className="ml-2 px-3 py-1 rounded-lg bg-green-600 text-white">Add Account</button>
              </div>
            </div>

            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800 mb-3">Bank Accounts</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3">Account</th>
                      <th className="px-6 py-3">Account No</th>
                      <th className="px-6 py-3">IFSC</th>
                      <th className="px-6 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(bankAccounts || []).map(acc => (
                      <tr key={acc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium">{acc.name}</td>
                        <td className="px-6 py-3">{acc.accountNumber || '-'}</td>
                        <td className="px-6 py-3">{acc.ifsc || '-'}</td>
                        <td className="px-6 py-3 text-right font-bold">₹{(acc.balance || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditAccount(acc); setShowEditAccountModal(true); }} className="px-3 py-1 rounded-lg border bg-white text-sm">Edit</button>
                        </td>
                      </tr>
                    ))}
                    {(bankAccounts || []).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-400">No bank accounts found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-3">Bank Transactions {(showAllBankTx ? '(All)' : '')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Account</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3 text-right">Credit</th>
                      <th className="px-6 py-3 text-right">Debit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const filtered = (bankTransactions || []).filter(tx => (showAllBankTx ? true : isWithinDate(tx.date)) && (bankFilter === 'ALL' ? true : tx.bankAccountId === bankFilter));
                      if (filtered.length === 0) return <tr><td colSpan={6} className="p-6 text-center text-gray-400">No bank transactions</td></tr>;
                      return filtered.map(tx => {
                        const acc = (bankAccounts || []).find(a => a.id === tx.bankAccountId);
                        return (
                          <tr key={tx.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3">{tx.date.includes('T') ? new Date(tx.date).toLocaleString() : tx.date}</td>
                            <td className="px-6 py-3">{acc ? `${acc.name}` : tx.bankAccountId}</td>
                            <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs ${tx.type === 'IN' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{tx.type}</span></td>
                            <td className="px-6 py-3">{tx.description || '-'}</td>
                            <td className="px-6 py-3 text-right text-green-700 font-medium">{tx.type === 'IN' ? `₹${tx.amount.toFixed(2)}` : '-'}</td>
                            <td className="px-6 py-3 text-right text-red-700 font-medium">{tx.type === 'OUT' ? `₹${tx.amount.toFixed(2)}` : '-'}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* PROFIT AND LOSS TAB */}
        {activeTab === 'PROFIT' && (
          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* Income Statement */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <PieIcon size={20} className="text-gray-500" /> Income Statement
                </h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Total Sales Revenue</span>
                    <span className="font-bold text-green-700 text-base">+ ₹{pl.revenue.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-gray-600">Total Purchases</span>
                    <span className="font-medium text-gray-800">- ₹{pl.totalPurchases.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                     <span className="text-gray-600">Operating Expenses</span>
                     <span className="font-medium text-red-600">- ₹{pl.totalExpenses.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                     <span className="text-gray-600">Inventory Loss (Damaged)</span>
                     <span className="font-medium text-red-600">- ₹{pl.damageLoss.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-gray-300">
                    <span className="text-xl font-bold text-gray-900">Net Profit</span>
                    <div className="text-right">
                       <span className={`text-2xl font-bold ${pl.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                         ₹{pl.netProfit.toFixed(2)}
                       </span>
                       {pl.revenue > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Margin: {((pl.netProfit / pl.revenue) * 100).toFixed(1)}%
                          </p>
                       )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Visualization */}
              <div className="flex flex-col h-full">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                   {pl.netProfit >= 0 ? <TrendingUp size={20} className="text-green-500"/> : <TrendingDown size={20} className="text-red-500"/>}
                   Financial Breakdown
                </h3>
                <div className="flex-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm min-h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={plChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 12}} />
                        <YAxis tick={{fontSize: 12}} />
                        <RechartsTooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                          {plChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-400 text-center mt-4">
                  * Damage Loss calculated based on stock aged &gt; 2 days within this period.
                </p>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Opening Balance Modal */}
      {showOBModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
              <div className="p-4 border-b">
                 <h3 className="text-lg font-bold">Add Opening Balance</h3>
              </div>
              <form onSubmit={handleAddOpeningBalance} className="p-4 space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cash Amount</label>
                    <input 
                       type="number"
                       className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                       placeholder="e.g. 500"
                       value={obAmount}
                       onChange={(e) => setObAmount(e.target.value)}
                       autoFocus
                       required
                    />
                 </div>
                 <div className="flex gap-2">
                    <button type="button" onClick={() => setShowOBModal(false)} className="flex-1 py-2 border rounded-lg">Cancel</button>
                    <button type="submit" className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-bold">Add</button>
                 </div>
              </form>
           </div>
        </div>
      )}
      {/* Bank Opening Balance Modal */}
      {showBankOBModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold">Add Bank Opening Balance</h3>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!bankObAmount || !bankObAccountId) return;
              await addBankTransaction({
                id: uuidv4(),
                bankAccountId: bankObAccountId,
                amount: Number(bankObAmount),
                type: 'IN',
                date: new Date().toISOString(),
                description: 'Opening Balance',
                createdBy: userName
              });
              setBankObAmount('');
              setBankObAccountId('');
              setShowBankOBModal(false);
            }} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
                <select className="w-full border p-2 rounded-lg outline-none" value={bankObAccountId} onChange={(e) => setBankObAccountId(e.target.value)} required>
                  <option value="">Select account</option>
                  {(bankAccounts || []).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} — {acc.accountNumber || ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input 
                   type="number"
                   className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="e.g. 5000"
                   value={bankObAmount}
                   onChange={(e) => setBankObAmount(e.target.value)}
                   required
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowBankOBModal(false)} className="flex-1 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

        {/* Edit Bank Account Modal */}
        {showEditAccountModal && editAccount && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
              <div className="p-4 border-b">
                <h3 className="text-lg font-bold">Edit Bank Account</h3>
              </div>
              <form onSubmit={async (e) => {
               e.preventDefault();
               // Save changes
               await updateBankAccount(editAccount);
               setShowEditAccountModal(false);
               setEditAccount(null);
              }} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                  <input 
                    type="text"
                    className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                    value={editAccount.name}
                    onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input 
                    type="text"
                    className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                    value={editAccount.accountNumber || ''}
                    onChange={(e) => setEditAccount({ ...editAccount, accountNumber: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
                  <input 
                    type="text"
                    className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                    value={editAccount.ifsc || ''}
                    onChange={(e) => setEditAccount({ ...editAccount, ifsc: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Balance (optional)</label>
                  <input 
                    type="number"
                    className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                    value={String(editAccount.balance || 0)}
                    onChange={(e) => setEditAccount({ ...editAccount, balance: Number(e.target.value) })}
                  />
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowEditAccountModal(false); setEditAccount(null); }} className="flex-1 py-2 border rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-bold">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
};
