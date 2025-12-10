
import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { StockBatch } from '../../types';
import { Calendar, TrendingUp, TrendingDown, DollarSign, PieChart as PieIcon, BookOpen, PlusCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

export const Reports = () => {
  const { sales, expenses, stock, supplierPayments, cashAdjustments, addCashAdjustment, userName } = useStore();
  const [activeTab, setActiveTab] = useState<'SALES' | 'PURCHASE' | 'EXPENSE' | 'PROFIT' | 'DAYBOOK'>('SALES');
  
  // Opening Balance Modal State
  const [showOBModal, setShowOBModal] = useState(false);
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
    supplierPayments.filter(p => isBeforeDate(p.date)).forEach(p => openingBalance -= p.amount);
    cashAdjustments.filter(c => isBeforeDate(c.date)).forEach(c => {
       openingBalance += (c.type === 'ADD' ? c.amount : -c.amount);
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

      // Purchases paid by cash (money out)
      filteredPurchases
        .filter(b => b.paymentStatus === 'PAID' || b.paymentStatus === 'CREDIT')
        .forEach(batch => {
          entries.push({
            date: batch.purchaseDate,
            desc: `Purchase: ${batch.productName} x${batch.originalQuantity} from ${batch.supplierName || 'Unknown'}`,
            type: 'EXPENSE',
            category: 'PURCHASE',
            credit: 0,
            debit: batch.originalQuantity * batch.purchasePrice
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

    supplierPayments.filter(p => isWithinDate(p.date)).forEach(p => entries.push({
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

    // Sort chronologically
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = openingBalance;
    const entriesWithBalance = entries.map(entry => {
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
      id: Math.random().toString(36).substr(2, 9),
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
  const calculatePL = () => {
     let revenue = 0;
     let cogs = 0;
     let damageLoss = 0;

     filteredSales.forEach(sale => {
       revenue += sale.totalAmount;
       sale.items.forEach(item => {
         const batch = stock.find(b => b.id === item.stockBatchId);
         if (batch) {
           cogs += item.quantity * batch.purchasePrice;
         } else {
           cogs += item.quantity * (item.price * 0.5); 
         }
       });
     });

     const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

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

     const grossProfit = revenue - cogs;
     const netProfit = grossProfit - totalExpenses - damageLoss;

     return { revenue, cogs, totalExpenses, damageLoss, grossProfit, netProfit };
  };

  const pl = calculatePL();

  const plChartData = [
    { name: 'Revenue', amount: pl.revenue, fill: '#10b981' },
    { name: 'COGS', amount: pl.cogs, fill: '#f59e0b' },
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
          onClick={() => setActiveTab('PROFIT')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'PROFIT' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'}`}
        >
          <DollarSign size={14} /> Profit & Loss
        </button>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        
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
                    <span className="text-gray-600">Cost of Goods Sold (COGS)</span>
                    <span className="font-medium text-gray-800">- ₹{pl.cogs.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 bg-gray-100 px-3 rounded-lg">
                    <span className="font-bold text-gray-800">Gross Profit</span>
                    <span className="font-bold text-gray-900">₹{pl.grossProfit.toFixed(2)}</span>
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
    </div>
  );
};
