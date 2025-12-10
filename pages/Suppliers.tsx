
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../context/StoreContext';
import { Truck, Plus, DollarSign, History, ChevronRight, X, Package, Calendar } from 'lucide-react';

export const Suppliers = () => {
  const { suppliers, addSupplier, stock, supplierPayments, addSupplierPayment, userRole } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const ALL_SUPPLIERS_ID = 'ALL_SUPPLIERS';
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  
  // Add Supplier Form
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');

  // Payment Form
  const { bankAccounts } = useStore();
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payMode, setPayMode] = useState<'CASH' | 'BANK'>('CASH');
  const [payBankAccountId, setPayBankAccountId] = useState<string>('');
  
  // Ledger Filters
  const today = new Date().toISOString().split('T')[0];
  const getMonthStart = () => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  };
  const monthStart = getMonthStart();
  
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BILL' | 'PAYMENT'>('ALL');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    addSupplier({
      id: uuidv4(),
      name: newName,
      contact: newContact,
      outstandingBalance: 0
    });
    setNewName('');
    setNewContact('');
    setShowAddModal(false);
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !payAmount) return;
    const paymentObj: any = {
      id: uuidv4(),
      supplierId: selectedSupplierId,
      amount: Number(payAmount),
      date: new Date().toISOString().split('T')[0],
      note: payNote,
      paymentMode: payMode
    };
    if (payMode === 'BANK' && payBankAccountId) paymentObj.bankAccountId = payBankAccountId;

    addSupplierPayment(paymentObj);
    setPayAmount('');
    setPayNote('');
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || (selectedSupplierId === ALL_SUPPLIERS_ID ? { id: ALL_SUPPLIERS_ID, name: 'All Suppliers', contact: '' } : null as any);
  const supplierPurchases = (selectedSupplierId === ALL_SUPPLIERS_ID ? stock : stock.filter(b => b.supplierId === selectedSupplierId)).sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  const supplierPays = (selectedSupplierId === ALL_SUPPLIERS_ID ? supplierPayments : supplierPayments.filter(p => p.supplierId === selectedSupplierId)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate actual outstanding balance from all transactions (not filtered by date)
  const calculateActualBalance = () => {
    let balance = 0;
    supplierPurchases.forEach(purchase => {
      balance += purchase.originalQuantity * purchase.purchasePrice;
    });
    supplierPays.forEach(payment => {
      balance -= payment.amount;
    });
    return Math.max(0, balance);
  };

  // --- GROUP PURCHASES BY INVOICE (BILL WISE) ---
  const groupedBills = (() => {
    const grouped: Record<string, any> = {};
    supplierPurchases.forEach(purchase => {
      const key = purchase.invoiceNo || purchase.purchaseDate;
      if (!grouped[key]) {
        grouped[key] = {
          id: purchase.id,
          invoiceNo: purchase.invoiceNo || `Bill-${purchase.purchaseDate}`,
          date: purchase.purchaseDate,
          items: [],
          totalAmount: 0
        };
      }
      grouped[key].items.push(purchase);
      grouped[key].totalAmount += purchase.originalQuantity * purchase.purchasePrice;
    });
    
    const bills = Object.values(grouped).map((bill: any) => ({
      ...bill,
      paymentStatus: bill.items.every((item: any) => item.paymentStatus === 'PAID') ? 'PAID' : 'PENDING'
    }));
    
    return bills.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      
      if (a.paymentStatus === 'PAID' && b.paymentStatus !== 'PAID') return -1;
      if (a.paymentStatus !== 'PAID' && b.paymentStatus === 'PAID') return 1;
      return 0;
    });
  })();
  
  // --- FILTER BILLS BY DATE RANGE ---
  const filteredBills = groupedBills.filter(bill => {
    return bill.date >= startDate && bill.date <= endDate;
  });
  
  // --- FILTER LEDGER BY DATE RANGE ---
  const filteredLedger = (() => {
    const entries = [
      ...filteredBills.map(bill => ({
        date: bill.date,
        invoiceNo: bill.invoiceNo,
        description: `Bill: ${bill.invoiceNo} (${bill.items.length} items)`,
        debit: bill.totalAmount,
        credit: 0,
        type: 'BILL',
        paymentStatus: bill.paymentStatus,
        bill: bill
      })),
      ...supplierPays.filter(p => p.date >= startDate && p.date <= endDate).map(p => ({
        date: p.date,
        invoiceNo: '-',
        description: p.note || 'Payment',
        debit: 0,
        credit: p.amount,
        type: 'PAYMENT',
        paymentStatus: 'PAID',
        bill: null
      }))
    ].sort((a, b) => {
      // Sort by date (newest first)
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      
      // Then payments first
      if (a.type === 'PAYMENT' && b.type !== 'PAYMENT') return -1;
      if (a.type !== 'PAYMENT' && b.type === 'PAYMENT') return 1;
      
      // Then paid bills first
      if (a.paymentStatus === 'PAID' && b.paymentStatus !== 'PAID') return -1;
      if (a.paymentStatus !== 'PAID' && b.paymentStatus === 'PAID') return 1;
      return 0;
    });
    
    // Calculate running balance
    let runningBalance = 0;
    return entries.map(entry => {
      runningBalance = runningBalance + entry.debit - entry.credit;
      return { ...entry, balance: runningBalance };
    });
  })();
  
  // --- APPLY SEARCH AND TYPE FILTER ---
  const searchedLedger = filteredLedger.filter(entry => {
    // Filter by type
    if (typeFilter !== 'ALL' && entry.type !== typeFilter) return false;
    
    // Filter by search term (invoice number or description)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        entry.invoiceNo.toLowerCase().includes(term) ||
        entry.description.toLowerCase().includes(term)
      );
    }
    return true;
  });
  
  // --- PAGINATION FOR LEDGER ---
  const totalPages = Math.ceil(searchedLedger.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLedger = searchedLedger.slice(startIndex, endIndex);
  
  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, selectedSupplierId, searchTerm, typeFilter]);

  const selectedBill = groupedBills.find(b => b.id === selectedBillId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Supplier Management</h2>
        
        {/* Only Admin can add new suppliers */}
        {userRole === 'ADMIN' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition-colors"
          >
            <Plus size={18} /> Add Supplier
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Supplier List */}
        <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-700">Suppliers List</h3>
          </div>
          <div className="divide-y divide-gray-100">
            <div
              key="all"
              onClick={() => setSelectedSupplierId(ALL_SUPPLIERS_ID)}
              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedSupplierId === ALL_SUPPLIERS_ID ? 'bg-pink-50 border-l-4 border-pink-500' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-800">All Suppliers</p>
                  <p className="text-xs text-gray-500">View all purchase bills</p>
                </div>
              </div>
            </div>
            {suppliers.map(sup => (
                <div 
                  key={sup.id} 
                  onClick={() => setSelectedSupplierId(sup.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedSupplierId === sup.id ? 'bg-pink-50 border-l-4 border-pink-500' : ''}`}
                >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800">{sup.name}</p>
                    <p className="text-xs text-gray-500">{sup.contact}</p>
                  </div>
                  {sup.outstandingBalance > 0 && (
                    <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">
                      -₹{sup.outstandingBalance}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supplier Details & Ledger */}
        <div className="md:col-span-2 space-y-6">
          {selectedSupplier ? (
            <>
              {/* Header Card with Outstanding Balance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-sm font-medium mb-2">Supplier Name</p>
                  <h2 className="text-xl font-bold text-gray-900">{selectedSupplier.name}</h2>
                  <p className="text-xs text-gray-500 mt-2">{selectedSupplier.contact}</p>
                </div>
                <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100">
                  <p className="text-red-600 text-sm font-medium mb-2">Outstanding Balance</p>
                  <p className="text-3xl font-bold text-red-600">₹{calculateActualBalance().toFixed(2)}</p>
                </div>
              </div>

              {/* Filters Section */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
                {/* Search Bar */}
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="Search by Invoice # or Description..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Type Filter & Date Range */}
                <div className="flex flex-wrap gap-3 items-center">
                  {/* Type Filter Dropdown */}
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as 'ALL' | 'BILL' | 'PAYMENT')}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="ALL">All Transactions</option>
                    <option value="BILL">Purchase Bills</option>
                    <option value="PAYMENT">Payments</option>
                  </select>

                  {/* Date Filter */}
                  <div className="flex gap-2 items-center">
                    <Calendar size={16} className="text-gray-500" />
                    <input 
                      type="date" 
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                    <span className="text-gray-400 text-sm">to</span>
                    <input 
                      type="date" 
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                    />
                  </div>

                  {/* Quick Date Buttons */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setStartDate(monthStart);
                        setEndDate(today);
                      }}
                      className="text-xs bg-blue-100 text-blue-700 px-3 py-2 rounded-lg font-semibold hover:bg-blue-200 transition-colors"
                    >
                      This Month
                    </button>
                    <button 
                      onClick={() => {
                        const lastMonth = new Date();
                        lastMonth.setMonth(lastMonth.getMonth() - 1);
                        lastMonth.setDate(1);
                        const lastMonthEnd = new Date();
                        lastMonthEnd.setDate(0);
                        setStartDate(lastMonth.toISOString().split('T')[0]);
                        setEndDate(lastMonthEnd.toISOString().split('T')[0]);
                      }}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Last Month
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Form (Accessible to Staff) */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl shadow-sm border border-green-100">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={18} className="text-green-600"/> Record Payment to Supplier</h3>
                <form onSubmit={handlePayment} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-green-500" 
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="Enter amount"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment Note</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-green-500" 
                        placeholder="e.g. UPI, Bank Transfer, Ref#123"
                        value={payNote}
                        onChange={e => setPayNote(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
                      <select className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none" value={payMode} onChange={e => setPayMode(e.target.value as any)}>
                        <option value="CASH">Cash</option>
                        <option value="BANK">Bank Transfer</option>
                      </select>
                      {payMode === 'BANK' && (
                        <select className="w-full mt-2 border border-gray-300 rounded-lg p-2 text-sm" value={payBankAccountId} onChange={e => setPayBankAccountId(e.target.value)}>
                          <option value="">Select bank account...</option>
                          {bankAccounts && bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>{b.name} ({b.accountNumber || '-'})</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-green-700 transition-colors shadow-md">
                        Record Payment
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* History Tabs */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                   <h3 className="font-bold flex items-center gap-2"><History size={18}/> Supplier Ledger</h3>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-sm">
                     <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
                         <tr>
                         <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                         <th className="px-4 py-3 text-left font-semibold text-gray-700">Invoice/Bill No</th>
                         {selectedSupplierId === ALL_SUPPLIERS_ID && <th className="px-4 py-3 text-left font-semibold text-gray-700">Supplier</th>}
                         <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                         <th className="px-4 py-3 text-right font-semibold text-red-600">Debit (Purchase)</th>
                         <th className="px-4 py-3 text-right font-semibold text-green-600">Credit (Payment)</th>
                         <th className="px-4 py-3 text-right font-semibold text-gray-700">Balance</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                       {paginatedLedger.map((entry, idx) => (
                         <tr 
                           key={idx}
                           onClick={() => entry.type === 'BILL' && setSelectedBillId(entry.bill.id)}
                           className={`hover:bg-gray-50 ${entry.type === 'BILL' ? 'cursor-pointer' : ''}`}
                         >
                           <td className="px-4 py-3 text-gray-700 font-medium">{entry.date}</td>
                           <td className="px-4 py-3 text-gray-700 font-bold">{entry.invoiceNo}</td>
                           {selectedSupplierId === ALL_SUPPLIERS_ID && <td className="px-4 py-3 text-gray-700">{entry.bill ? entry.bill.supplierName || '-' : '-'}</td>}
                           <td className="px-4 py-3 text-gray-700">
                             <span className={`px-2 py-1 rounded text-xs font-semibold ${entry.type === 'BILL' ? 'bg-blue-50 text-blue-700 cursor-pointer hover:bg-blue-100' : 'bg-green-50 text-green-700'}`}>
                               {entry.description}
                             </span>
                           </td>
                           <td className="px-4 py-3 text-right font-bold text-red-600">
                             {entry.debit > 0 ? `₹${entry.debit.toFixed(0)}` : '–'}
                           </td>
                           <td className="px-4 py-3 text-right font-bold text-green-600">
                             {entry.credit > 0 ? `₹${entry.credit.toFixed(0)}` : '–'}
                           </td>
                           <td className={`px-4 py-3 text-right font-bold ${entry.balance > 0 ? 'text-red-600 bg-red-50' : 'text-gray-700'}`}>
                             ₹{entry.balance.toFixed(0)}
                           </td>
                         </tr>
                       ))}
                       {paginatedLedger.length === 0 && searchedLedger.length === 0 && (
                         <tr>
                           <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                             No transactions matching filters
                           </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                </div>
                
                {/* Pagination Controls */}
                {searchedLedger.length > ITEMS_PER_PAGE && (
                  <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center flex-wrap gap-4">
                    <div className="text-sm text-gray-600">
                      Showing <span className="font-bold">{startIndex + 1}</span> to <span className="font-bold">{Math.min(endIndex, searchedLedger.length)}</span> of <span className="font-bold">{searchedLedger.length}</span> transactions
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-300">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded font-semibold text-sm ${currentPage === page ? 'bg-pink-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 p-10">
               <Truck size={48} className="mb-4 opacity-20" />
               <p>Select a supplier to view details</p>
             </div>
          )}
        </div>
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-96">
            <h3 className="text-xl font-bold mb-4">Add New Supplier</h3>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Supplier Name</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Contact / Phone</label>
                <input 
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none" 
                  value={newContact} 
                  onChange={e => setNewContact(e.target.value)} 
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill Details Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Bill Details</h3>
                <p className="text-sm text-gray-500">Date: {selectedBill.date}</p>
              </div>
              <button onClick={() => setSelectedBillId(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Bill Summary */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Items</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedBill.items.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Bill Amount</p>
                    <p className="text-2xl font-bold text-blue-600">₹{selectedBill.totalAmount.toFixed(0)}</p>
                  </div>
                </div>
              </div>

              {/* Bill Items Table */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Package size={18} /> Bill Items
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left">Product</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3 text-right">Cost/Unit</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedBill.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{item.originalQuantity}</td>
                          <td className="px-4 py-3 text-right text-gray-700">₹{item.purchasePrice.toFixed(0)}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">₹{(item.originalQuantity * item.purchasePrice).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bill Total */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-right">
                <p className="text-sm text-gray-600 mb-1">Bill Total</p>
                <p className="text-3xl font-bold text-blue-600">₹{selectedBill.totalAmount.toFixed(0)}</p>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setSelectedBillId(null)}
                className="w-full py-3 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
