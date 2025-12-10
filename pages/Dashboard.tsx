
import React, { useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { TrendingUp, DollarSign, PackageX, ShoppingBag, ClipboardList, Wallet, ArrowDownLeft, ArrowUpRight, CreditCard, Banknote, Smartphone, Scale } from 'lucide-react';
import { StaffActivity } from '../types';
import { sanitizeText } from '../utils/sanitize';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export const Dashboard = () => {
  const { 
    sales, stock, expenses, 
    customerPayments, supplierPayments, customers, cashAdjustments,
    getComputedStock, userRole, userName, bankAccounts, bankTransactions
  , bankSummary } = useStore();
  
  const today = new Date().toISOString().split('T')[0];
  
  // Common Totals
  const todaySales = sales.filter(s => s.date.startsWith(today));
  
  // --- OPENING BALANCE CALCULATION ---
  // Sum of all cash flows strictly BEFORE today
  const openingBalance = useMemo(() => {
    let balance = 0;
    
    // 1. Sales (Cash Received)
    sales.filter(s => s.date.split('T')[0] < today).forEach(s => {
      balance += s.amountPaid;
    });

    // 2. Customer Payments (Cash In)
    customerPayments.filter(p => p.date.split('T')[0] < today).forEach(p => {
      balance += p.amount;
    });

    // 3. Cash Adjustments (Add/Remove)
    cashAdjustments.filter(c => c.date.split('T')[0] < today).forEach(c => {
       balance += (c.type === 'ADD' ? c.amount : -c.amount);
    });

    // 4. Expenses (Cash Out)
    expenses.filter(e => e.date.split('T')[0] < today).forEach(e => {
      balance -= e.amount;
    });

    // 5. Supplier Payments (Cash Out)
    supplierPayments.filter(p => p.date.split('T')[0] < today).forEach(p => {
      balance -= p.amount;
    });

    return balance;
  }, [sales, customerPayments, cashAdjustments, expenses, supplierPayments, today]);

  // Compute closing balance (Current Cash In Hand) using same logic as AdminDashboard
  const closingBalance = useMemo(() => {
    // Today's sales
    const todaySalesLocal = sales.filter(s => s.date.startsWith(today));
    const cashSalesToday = todaySalesLocal.filter(s => s.paymentMode === 'CASH').reduce((sum, s) => sum + s.amountPaid, 0);

    // Debt collected today
    const todayDebtCollectedLocal = customerPayments.filter(p => p.date.startsWith(today)).reduce((sum, p) => sum + p.amount, 0);

    // Cash adjustments today
    const todayAdjustmentsLocal = cashAdjustments.filter(c => c.date.startsWith(today));
    const todayCashAddedLocal = todayAdjustmentsLocal.filter(c => c.type === 'ADD').reduce((sum, c) => sum + c.amount, 0);
    const todayCashRemovedLocal = todayAdjustmentsLocal.filter(c => c.type === 'REMOVE').reduce((sum, c) => sum + c.amount, 0);

    // Expenses today
    const totalExpensesTodayLocal = expenses.filter(e => e.date.startsWith(today)).reduce((sum, e) => sum + e.amount, 0);

    // Supplier payments today
    const todaySupplierPaidLocal = supplierPayments.filter(p => p.date.startsWith(today)).reduce((sum, p) => sum + p.amount, 0);

    const todayCashInflowLocal = cashSalesToday + todayDebtCollectedLocal + todayCashAddedLocal;
    const todayCashOutflowLocal = totalExpensesTodayLocal + todaySupplierPaidLocal + todayCashRemovedLocal;

    return openingBalance + todayCashInflowLocal - todayCashOutflowLocal;
  }, [openingBalance, sales, customerPayments, cashAdjustments, expenses, supplierPayments, today]);

  // --- ADMIN VIEW ---
  const AdminDashboard = () => {
    // 1. Sales Breakdown (By Payment Mode)
    const cashSales = todaySales.filter(s => s.paymentMode === 'CASH').reduce((sum, s) => sum + s.totalAmount, 0);
    const upiSales = todaySales.filter(s => s.paymentMode === 'UPI').reduce((sum, s) => sum + s.totalAmount, 0);
    const creditSales = todaySales.filter(s => s.paymentMode === 'CREDIT').reduce((sum, s) => sum + s.totalAmount, 0);
    const totalSalesToday = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);

    // 2. Expenses
    const totalExpensesToday = expenses
      .filter(e => e.date.startsWith(today))
      .reduce((sum, e) => sum + e.amount, 0);

    // 3. Debt Collections (Money received from old credit customers today)
    const todayDebtCollected = customerPayments
      .filter(p => p.date.startsWith(today))
      .reduce((sum, p) => sum + p.amount, 0);

    // 4. Cash Adjustments Today
    const todayAdjustments = cashAdjustments.filter(c => c.date.startsWith(today));
    const todayCashAdded = todayAdjustments.filter(c => c.type === 'ADD').reduce((sum, c) => sum + c.amount, 0);
    const todayCashRemoved = todayAdjustments.filter(c => c.type === 'REMOVE').reduce((sum, c) => sum + c.amount, 0);

    // 5. Supplier Payments Today
    const todaySupplierPaid = supplierPayments
      .filter(p => p.date.startsWith(today))
      .reduce((sum, p) => sum + p.amount, 0);

    // 5.a Total Purchases Today (sum of purchase invoice totals where purchaseDate == today)
    const todayPurchases = stock
      .filter(b => (b.purchaseDate || '').startsWith(today))
      // Group by invoiceNo when available, otherwise treat each batch as its own invoice
      .reduce((acc: Record<string, number>, batch) => {
        const key = batch.invoiceNo && batch.invoiceNo.trim() !== '' ? `INV::${batch.invoiceNo}` : `BATCH::${batch.id}`;
        const amt = (batch.originalQuantity || batch.quantity || 0) * (batch.purchasePrice || 0);
        acc[key] = (acc[key] || 0) + amt;
        return acc;
      }, {} as Record<string, number>);

    const totalPurchasesToday = Object.values(todayPurchases).reduce((s, v) => s + v, 0);

    // 6. Total Actual Collection (Cash In Hand + Bank/UPI In Bank)
    const todaySalesReceived = todaySales.reduce((sum, s) => sum + s.amountPaid, 0);
    const totalCollectionToday = todaySalesReceived + todayDebtCollected;

    // 7. Closing Balance (Current Cash In Hand)
    // Formula: Opening + (Cash Sales + Debt Collect + Cash Added) - (Expenses + Supplier Pays + Cash Removed)
    // Note: This approximates pure Cash if we assume Expenses/SupplierPays are cash. 
    // If UPI Sales go to bank, we should exclude them from "Cash Drawer" but include in "Revenue".
    // For simplicity, this calculates 'Net Cash Flow' assuming sales receipts are mixed. 
    // To be precise for Cash Drawer:
    const todayCashInflow = (todaySales.filter(s => s.paymentMode === 'CASH').reduce((sum, s) => sum + s.amountPaid, 0)) 
                            + todayDebtCollected 
                            + todayCashAdded;
    
    const todayCashOutflow = totalExpensesToday + todaySupplierPaid + todayCashRemoved;
    const closingBalance = openingBalance + todayCashInflow - todayCashOutflow;

    // Compute bank balance based on bank transactions to reflect formula:
    // Bank = Opening Bank Balance + UPI IN - (Bank Expenses + Supplier Payments via Bank)
    const allBankTx: any[] = (bankAccounts ? (/* placeholder for lint */ [] as any[]) : []) as any[];
    // we will use bankTransactions from context (closure) if available
    const bankTxList: any[] = (globalThis as any).__BANK_TX_FALLBACK || [];
    // Safer: try to read bankTransactions from outer scope (it exists in StoreContext via closure)
    let inferredBankTx: any[] = [];
    try { inferredBankTx = (bankTransactions as any) || []; } catch { inferredBankTx = []; }

    const sumBy = (arr: any[], predicate: (t: any) => boolean) => arr.filter(predicate).reduce((s, t) => s + (t.amount || 0), 0);
    // Prefer server-provided summary when available
    const serverSummary = bankSummary;
    const openingIn = serverSummary ? serverSummary.openingIn : sumBy(inferredBankTx, (t) => /opening/i.test(t.description || ''));
    const upiIn = serverSummary ? serverSummary.upiIn : sumBy(inferredBankTx, (t) => t.type === 'IN' && /upi/i.test((t.description || '').toLowerCase()));
    const totalIn = serverSummary ? serverSummary.totalIn : sumBy(inferredBankTx, (t) => t.type === 'IN');
    const totalOut = serverSummary ? serverSummary.totalOut : sumBy(inferredBankTx, (t) => t.type === 'OUT');
    const supplierOut = serverSummary ? serverSummary.supplierOut : sumBy(inferredBankTx, (t) => t.type === 'OUT' && /supplier/i.test((t.description || '').toLowerCase()));
    const expensesOut = serverSummary ? serverSummary.expensesOut : (totalOut - supplierOut);

    const computedBankBalance = serverSummary ? serverSummary.computedBalance : (totalIn - totalOut);
    const openingFromDaybook = serverSummary ? (serverSummary.openingFromDaybook || 0) : 0;
    const computedWithOpening = serverSummary ? (serverSummary.computedBalanceWithOpening || (computedBankBalance + openingFromDaybook)) : (computedBankBalance + openingFromDaybook);
    const sumAccountBalances = serverSummary ? serverSummary.accountBalances : (bankAccounts || []).reduce((sum, b) => sum + (b.balance || 0), 0);
    const totalBankBalance = (sumAccountBalances !== 0) ? sumAccountBalances : computedWithOpening;

    const { damagedStock } = getComputedStock();
    const damagedValue = damagedStock.reduce((sum, batch) => sum + (batch.quantity * batch.purchasePrice), 0);

    // 8. Profit Est
    const profitToday = totalSalesToday - totalExpensesToday - damagedValue;

    const paymentData = [
      { name: 'Cash', value: cashSales },
      { name: 'UPI', value: upiSales },
      { name: 'Credit', value: creditSales },
    ].filter(d => d.value > 0);

    const salesByDayMap = sales.reduce((acc, sale) => {
      const date = sale.date.split('T')[0];
      acc[date] = (acc[date] || 0) + sale.totalAmount;
      return acc;
    }, {} as Record<string, number>);

    const salesData = Object.keys(salesByDayMap).slice(-7).map(date => ({
      date,
      amount: salesByDayMap[date]
    }));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
        
        {/* CASH FLOW / OPENING BALANCE SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="bg-gray-800 rounded-xl p-6 text-white shadow-lg flex justify-between items-center">
              <div>
                 <p className="text-gray-400 text-sm font-medium mb-1">Opening Balance (Today)</p>
                 <h3 className="text-3xl font-bold">₹{openingBalance.toFixed(0)}</h3>
                 <p className="text-xs text-gray-500 mt-2">Cash carry-over from yesterday</p>
              </div>
              <div className="bg-gray-700 p-3 rounded-lg">
                 <Scale className="text-pink-400" size={24} />
              </div>
           </div>

           <div className="bg-gradient-to-r from-pink-600 to-pink-500 rounded-xl p-6 text-white shadow-lg flex justify-between items-center">
              <div>
                 <p className="text-pink-100 text-sm font-medium mb-1">Current Cash In Hand</p>
                 <h3 className="text-3xl font-bold">₹{closingBalance.toFixed(0)}</h3>
                 <p className="text-xs text-pink-200 mt-2">Opening + Today's Net Cash Flow</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                 <Wallet className="text-white" size={24} />
              </div>
           </div>
        </div>

        {/* TODAY'S COLLECTION REPORT SECTION */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
             <ClipboardList className="text-pink-600" /> Today's Collection & Activity
           </h3>
           
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* 1. Cash Sales */}
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                 <p className="text-xs text-green-600 font-bold uppercase mb-1">Total Cash Sales</p>
                 <div className="flex items-center gap-2">
                    <Banknote size={18} className="text-green-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{cashSales.toFixed(0)}</h4>
                 </div>
              </div>

              {/* 2. UPI Sales */}
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                 <p className="text-xs text-purple-600 font-bold uppercase mb-1">Total UPI Sales</p>
                 <div className="flex items-center gap-2">
                    <Smartphone size={18} className="text-purple-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{upiSales.toFixed(0)}</h4>
                 </div>
              </div>

              {/* 3. Credit Sales */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                 <p className="text-xs text-red-600 font-bold uppercase mb-1">Total Credit Given</p>
                 <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-red-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{creditSales.toFixed(0)}</h4>
                 </div>
              </div>

              {/* 4. Debt Recovered */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                 <p className="text-xs text-blue-600 font-bold uppercase mb-1">Debt Recovered</p>
                 <div className="flex items-center gap-2">
                    <ArrowDownLeft size={18} className="text-blue-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{todayDebtCollected.toFixed(0)}</h4>
                 </div>
              </div>

              {/* 5. Expenses */}
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                 <p className="text-xs text-orange-600 font-bold uppercase mb-1">Total Expenses</p>
                 <div className="flex items-center gap-2">
                    <ArrowUpRight size={18} className="text-orange-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{totalExpensesToday.toFixed(0)}</h4>
                 </div>
              </div>

                {/* 8. Purchases Today */}
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                  <p className="text-xs text-yellow-600 font-bold uppercase mb-1">Total Today Purchases</p>
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={18} className="text-yellow-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{totalPurchasesToday.toFixed(2)}</h4>
                  </div>
                </div>

              {/* 6. TOTAL COLLECTED */}
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 text-white">
                 <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total In-Hand</p>
                 <div className="flex items-center gap-2">
                    <DollarSign size={18} className="text-green-400"/>
                    <h4 className="text-xl font-bold">₹{totalCollectionToday.toFixed(0)}</h4>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-1">Cash + UPI + Collections</p>
              </div>

                {/* 7. Bank Accounts (show each account as a simple tile: name + balance) */}
                {(() => {
                  const accountTiles: Array<{ id: string; name: string; balance: number }> = [];
                  if (serverSummary && serverSummary.perAccount && serverSummary.perAccount.length > 0) {
                    serverSummary.perAccount.forEach((acc: any) => {
                      const bal = (typeof acc.computedBalance === 'number' ? acc.computedBalance : (acc.accountBalance || 0));
                      accountTiles.push({ id: acc.bankAccountId, name: acc.name, balance: bal });
                    });
                  } else {
                    (bankAccounts || []).forEach((b: any) => accountTiles.push({ id: b.id, name: b.name, balance: b.balance || 0 }));
                  }

                  if (accountTiles.length === 0) {
                    return (
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-sm font-semibold text-gray-700 mb-2">No Bank Accounts</p>
                        <div className="flex items-center gap-2">
                          <Banknote size={18} className="text-blue-500"/>
                          <h4 className="text-xl font-bold text-gray-800">₹0</h4>
                        </div>
                      </div>
                    );
                  }

                  return accountTiles.map(a => (
                    <div key={a.id} className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-sm font-semibold text-gray-700 mb-2">{sanitizeText(a.name)}</p>
                      <div className="flex items-center gap-2">
                        <Banknote size={18} className="text-blue-500"/>
                        <h4 className="text-xl font-bold text-gray-800">₹{a.balance.toFixed(0)}</h4>
                      </div>
                    </div>
                  ));
                })()}
           </div>
        </div>

        {/* General Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Sales Volume</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">₹{totalSalesToday.toFixed(2)}</h3>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <TrendingUp className="text-blue-600 w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-500">Includes unpaid credit sales</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Net Profit</p>
                <h3 className={`text-2xl font-bold mt-2 ${profitToday >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{profitToday.toFixed(2)}
                </h3>
              </div>
              <div className="bg-green-100 p-2 rounded-lg">
                <DollarSign className="text-green-600 w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-500">Revenue - Expenses - Damage</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium">Damaged Stock Value</p>
                <h3 className="text-2xl font-bold text-red-600 mt-2">₹{damagedValue.toFixed(2)}</h3>
              </div>
              <div className="bg-red-100 p-2 rounded-lg">
                <PackageX className="text-red-600 w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-500">Items marked as damaged</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Sales Trend (Last 7 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Bar dataKey="amount" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Today's Payment Modes</h3>
            <div className="h-64 flex justify-center">
              {paymentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `₹${value}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center text-gray-400">No sales today</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- STAFF VIEW ---
  const StaffDashboard = () => {
    // Staff specific data
    const myTodaySales = todaySales.filter(s => s.createdBy === userName);
    const myExpenses = expenses.filter(e => e.createdBy === userName && e.date.startsWith(today));
    const myPayments = customerPayments.filter(p => p.createdBy === userName && p.date.startsWith(today));

    // Stats Calculation
    const myCashSalesVal = myTodaySales.filter(s => s.paymentMode === 'CASH').reduce((sum, s) => sum + s.totalAmount, 0);
    const myUpiSalesVal = myTodaySales.filter(s => s.paymentMode === 'UPI').reduce((sum, s) => sum + s.totalAmount, 0);
    const myCreditSalesVal = myTodaySales.filter(s => s.paymentMode === 'CREDIT').reduce((sum, s) => sum + s.totalAmount, 0);
    
    const myExpensesVal = myExpenses.reduce((sum, e) => sum + e.amount, 0);
    const myDebtRecoveredVal = myPayments.reduce((sum, p) => sum + p.amount, 0);

    // Total Collection: (Amount actually paid in Sales) + (Debt Recovered)
    const mySalesReceived = myTodaySales.reduce((sum, s) => sum + s.amountPaid, 0);
    const myTotalCollection = mySalesReceived + myDebtRecoveredVal;

    // Aggregate all staff activities for today (Day Book List)
    const activities: StaffActivity[] = useMemo(() => {
      const list: StaffActivity[] = [];
      
      // 1. My Sales
      myTodaySales.forEach(s => {
        list.push({
          id: s.id,
          time: s.date,
          type: 'SALE',
          description: `Sale: ${s.customerName} (${s.items.length} items)`,
          amount: s.amountPaid, // Cash/Amount received
          isIncome: true,
          mode: s.paymentMode
        });
      });

      // 2. My Expenses
      myExpenses.forEach(e => {
        list.push({
          id: e.id,
          time: e.date.includes('T') ? e.date : e.date + 'T12:00:00.000Z', 
          type: 'EXPENSE',
          description: `Exp: ${e.category} - ${e.description}`,
          amount: e.amount,
          isIncome: false,
          mode: 'CASH'
        });
      });

      // 3. Customer Payments Received
      myPayments.forEach(p => {
        const cust = customers.find(c => c.id === p.customerId);
        list.push({
          id: p.id,
          time: p.date,
          type: 'CUST_PAYMENT',
          description: `Collection: ${cust?.name || 'Customer'}`,
          amount: p.amount,
          isIncome: true,
          mode: 'CASH'
        });
      });
      
      return list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()); // Latest first
    }, [myTodaySales, myExpenses, myPayments, customers]);

    return (
      <div className="space-y-6">
        <div className="bg-pink-600 rounded-xl p-8 text-white shadow-lg flex justify-between items-center">
           <div>
              <h2 className="text-3xl font-bold mb-2">Hello, {sanitizeText(userName)}!</h2>
              <p className="opacity-90">Today's Activity: {new Date().toLocaleDateString()}</p>
           </div>
           
            {/* OPENING BALANCE for Staff — show same Current Cash In Hand as Admin */}
            <div className="bg-pink-700/50 p-4 rounded-xl text-center min-w-[150px] border border-pink-400/30">
              <p className="text-pink-200 text-xs uppercase font-bold mb-1">Current Cash In Hand</p>
              <h3 className="text-2xl font-bold">₹{closingBalance.toFixed(0)}</h3>
            </div>
        </div>

        {/* STAFF: TODAY'S COLLECTION & ACTIVITY BREAKDOWN */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
             <Wallet className="text-pink-600" /> My Today's Collection
           </h3>
           
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* 1. Cash Sales */}
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                 <p className="text-xs text-green-600 font-bold uppercase mb-1">My Cash Sales</p>
                 <div className="flex items-center gap-2">
                    <Banknote size={18} className="text-green-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{myCashSalesVal.toFixed(0)}</h4>
                 </div>
              </div>

              {/* 2. UPI Sales */}
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                 <p className="text-xs text-purple-600 font-bold uppercase mb-1">My UPI Sales</p>
                 <div className="flex items-center gap-2">
                    <Smartphone size={18} className="text-purple-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{myUpiSalesVal.toFixed(0)}</h4>
                 </div>
              </div>

              {/* 3. Credit Sales */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                 <p className="text-xs text-red-600 font-bold uppercase mb-1">My Credit Given</p>
                 <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-red-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{myCreditSalesVal.toFixed(0)}</h4>
                 </div>
              </div>

              {/* 4. Debt Recovered */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                 <p className="text-xs text-blue-600 font-bold uppercase mb-1">My Debt Recovered</p>
                 <div className="flex items-center gap-2">
                    <ArrowDownLeft size={18} className="text-blue-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{myDebtRecoveredVal.toFixed(0)}</h4>
                 </div>
              </div>

              {/* 5. Expenses */}
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                 <p className="text-xs text-orange-600 font-bold uppercase mb-1">My Expenses</p>
                 <div className="flex items-center gap-2">
                    <ArrowUpRight size={18} className="text-orange-500"/>
                    <h4 className="text-xl font-bold text-gray-800">₹{myExpensesVal.toFixed(0)}</h4>
                 </div>
              </div>

              {/* 6. TOTAL COLLECTED */}
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 text-white">
                 <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total My Collection</p>
                 <div className="flex items-center gap-2">
                    <DollarSign size={18} className="text-green-400"/>
                    <h4 className="text-xl font-bold">₹{myTotalCollection.toFixed(0)}</h4>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-1">Cash + UPI + Recoveries</p>
              </div>
           </div>
        </div>

        {/* Day Book Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800">My Day Book (Detailed List)</h3>
           </div>
           <table className="w-full text-left text-sm">
             <thead className="bg-white text-gray-500 border-b border-gray-100">
               <tr>
                 <th className="px-6 py-3">Time</th>
                 <th className="px-6 py-3">Type</th>
                 <th className="px-6 py-3">Description</th>
                 <th className="px-6 py-3">Mode</th>
                 <th className="px-6 py-3 text-right">Credit (+)</th>
                 <th className="px-6 py-3 text-right">Debit (-)</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {activities.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-400">No activity recorded by you today.</td></tr>
               ) : (
                 activities.map(act => (
                   <tr key={act.id} className="hover:bg-gray-50">
                     <td className="px-6 py-3 text-gray-500">{act.time.includes('T') ? new Date(act.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                     <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase 
                          ${act.type === 'SALE' ? 'bg-blue-100 text-blue-700' : 
                            act.type === 'EXPENSE' ? 'bg-red-100 text-red-700' : 
                            act.type === 'CUST_PAYMENT' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                           {act.type.replace('_', ' ')}
                        </span>
                     </td>
                     <td className="px-6 py-3 font-medium text-gray-700">{sanitizeText(act.description)}</td>
                     <td className="px-6 py-3">{sanitizeText(act.mode)}</td>
                     <td className="px-6 py-3 text-right font-bold text-green-600">{act.isIncome ? `₹${act.amount}` : '-'}</td>
                     <td className="px-6 py-3 text-right font-bold text-red-600">{!act.isIncome ? `₹${act.amount}` : '-'}</td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
        </div>
      </div>
    );
  }

  return userRole === 'ADMIN' ? <AdminDashboard /> : <StaffDashboard />;
};
    