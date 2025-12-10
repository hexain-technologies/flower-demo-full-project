
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { DollarSign, UserCheck, Search, FileText, CreditCard, Phone, User, X, Package } from 'lucide-react';

export const Credits = () => {
  const { customers, sales, customerPayments, addCustomerPayment, bankAccounts } = useStore();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  
  // Payment Form State
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK' | 'CHEQUE'>('CASH');
  const [payBankAccountId, setPayBankAccountId] = useState<string>('');

  // Filter Customers
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !payAmount) return;
    
    addCustomerPayment(selectedCustomerId, Number(payAmount), payMethod, payMethod === 'UPI' ? payBankAccountId || undefined : undefined);
    setPayAmount('');
    setCurrentPage(1); // Reset pagination on new payment
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Calculate Ledger History for Selected Customer
  const getCustomerHistory = () => {
    if (!selectedCustomerId) return [];

    // 1. Get Credit Bills (Sales)
    const creditSales = sales.filter(s => s.customerId === selectedCustomerId && s.paymentMode === 'CREDIT').map(s => ({
      id: s.id,
      date: s.date,
      type: 'BILL',
      description: `Bill #${s.id.substr(0, 6).toUpperCase()}`,
      // The amount added to debt is Total - Initial Payment
      amount: s.totalAmount - s.amountPaid, 
      totalBill: s.totalAmount,
      initialPay: s.amountPaid
    }));

    // 2. Get Payments Received
    const payments = customerPayments.filter(p => p.customerId === selectedCustomerId).map(p => ({
      id: p.id,
      date: p.date,
      type: 'PAYMENT',
      description: `Payment Received${p.paymentMethod ? ' (' + p.paymentMethod + ')' : ''}`,
      amount: p.amount,
      totalBill: 0,
      initialPay: 0
    }));

    // 3. Merge and Sort (Newest First)
    return [...creditSales, ...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const history = getCustomerHistory();
  
  // Pagination Logic
  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedHistory = history.slice(startIndex, endIndex);
  
  // Reset page when customer changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedCustomerId]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Credit Management</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
        
        {/* LEFT COLUMN: Customer List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <h3 className="font-bold text-gray-700">Customer List</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search name or phone..." 
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-pink-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredCustomers.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No customers found</div>
            ) : (
              filteredCustomers.map(cust => (
                <div 
                  key={cust.id}
                  onClick={() => setSelectedCustomerId(cust.id)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedCustomerId === cust.id ? 'bg-pink-50 border-l-4 border-pink-500' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-semibold ${selectedCustomerId === cust.id ? 'text-pink-700' : 'text-gray-800'}`}>{cust.name}</p>
                      {cust.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <Phone size={10} /> {cust.phone}
                        </div>
                      )}
                    </div>
                    {cust.outstandingBalance > 0 ? (
                      <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
                        ₹{cust.outstandingBalance.toFixed(0)}
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-600 text-xs font-bold px-2 py-1 rounded-full">
                        Settled
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Detailed View */}
        <div className="md:col-span-2 flex flex-col gap-6 overflow-y-auto pr-1">
          {selectedCustomer ? (
            <>
              {/* Customer Info Header */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-pink-600">
                      <User size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                      <p className="text-gray-500 text-sm flex items-center gap-2">
                         {selectedCustomer.phone || 'No phone number'}
                      </p>
                    </div>
                 </div>
                 <div className="text-right bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                    <p className="text-xs text-red-500 font-bold uppercase">Outstanding Due</p>
                    <p className="text-2xl font-bold text-red-600">₹{selectedCustomer.outstandingBalance.toFixed(2)}</p>
                 </div>
              </div>

              {/* Payment Section */}
              {selectedCustomer.outstandingBalance > 0 && (
                <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-6 rounded-xl text-white shadow-lg">
                   <h3 className="font-bold flex items-center gap-2 mb-4">
                     <CreditCard size={20} /> Collect Payment
                   </h3>
                   <form onSubmit={handlePayment} className="flex gap-4 items-end">
                      <div className="flex-1">
                         <label className="text-xs text-gray-300 block mb-1">Enter Amount Received</label>
                         <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-800">₹</span>
                            <input 
                              type="number" 
                              className="w-full pl-8 pr-4 py-3 rounded-lg text-gray-900 font-bold outline-none focus:ring-2 focus:ring-pink-500"
                              placeholder="0.00"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              max={selectedCustomer.outstandingBalance}
                              min={1}
                              required
                              autoFocus
                            />
                         </div>
                      </div>
                      <div className="w-56">
                        <label className="text-xs text-gray-300 block mb-1">Payment Method</label>
                        <select className="w-full p-2 rounded-lg text-gray-900" value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)}>
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="CARD">Card</option>
                          <option value="BANK">Bank Transfer</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                        {payMethod === 'UPI' && (
                          <select className="w-full p-2 mt-2 rounded-lg text-gray-900" value={payBankAccountId} onChange={(e) => setPayBankAccountId(e.target.value)}>
                            <option value="">-- Select Bank Account --</option>
                            {bankAccounts && bankAccounts.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.name} ({acc.accountNumber || 'NA'})</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <button className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-bold transition-colors shadow-lg">
                        Confirm Payment
                      </button>
                   </form>
                </div>
              )}

              {/* Transaction History Ledger */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                 <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                       <FileText size={18} /> Transaction History
                    </h3>
                    <span className="text-xs text-gray-500">{history.length} Records</span>
                 </div>
                 
                 <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white border-b border-gray-100 text-gray-500">
                         <tr>
                           <th className="px-6 py-3">Date</th>
                           <th className="px-6 py-3">Particulars</th>
                           <th className="px-6 py-3 text-right text-red-600">Debt Added (+)</th>
                           <th className="px-6 py-3 text-right text-green-600">Paid (-)</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedHistory.length === 0 ? (
                           <tr><td colSpan={4} className="p-8 text-center text-gray-400">No history available</td></tr>
                        ) : (
                          paginatedHistory.map((item, idx) => (
                            <tr 
                              key={idx} 
                              onClick={() => item.type === 'BILL' && setSelectedBillId(item.id)}
                              className={`hover:bg-gray-50 ${item.type === 'BILL' ? 'cursor-pointer' : ''}`}
                            >
                              <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                {new Date(item.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                              </td>
                              <td className="px-6 py-4">
                                <p className={`font-medium ${item.type === 'BILL' ? 'text-blue-600 underline' : 'text-gray-900'}`}>{item.description}</p>
                                {item.type === 'BILL' && item.initialPay > 0 && (
                                   <p className="text-xs text-gray-500 mt-1">
                                     Bill Total: ₹{item.totalBill} (Paid ₹{item.initialPay} upfront)
                                   </p>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-red-600">
                                {item.type === 'BILL' ? `₹${item.amount.toFixed(2)}` : '-'}
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-green-600">
                                {item.type === 'PAYMENT' ? `₹${item.amount.toFixed(2)}` : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                 </div>
                 
                 {/* Pagination Controls */}
                 <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                   <span className="text-xs text-gray-600">
                     Showing {startIndex + 1} to {Math.min(endIndex, history.length)} of {history.length} transactions
                   </span>
                   <div className="flex gap-2">
                     <button
                       onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                       disabled={currentPage === 1}
                       className="px-3 py-1 border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       Previous
                     </button>
                     {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                       const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                       return pageNum <= totalPages ? (
                         <button
                           key={pageNum}
                           onClick={() => setCurrentPage(pageNum)}
                           className={`px-2 py-1 rounded text-xs font-medium ${
                             currentPage === pageNum
                               ? 'bg-pink-500 text-white'
                               : 'border border-gray-200 text-gray-700 hover:bg-gray-100'
                           }`}
                         >
                           {pageNum}
                         </button>
                       ) : null;
                     })}
                     <button
                       onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                       disabled={currentPage === totalPages}
                       className="px-3 py-1 border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       Next
                     </button>
                   </div>
                 </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 p-10">
               <UserCheck size={64} className="mb-4 opacity-20" />
               <p className="text-lg font-medium">Select a customer</p>
               <p className="text-sm">View details, history, and collect payments</p>
            </div>
          )}
        </div>
      </div>

      {/* Bill Details Modal */}
      {selectedBillId && (() => {
        const bill = sales.find(s => s.id === selectedBillId);
        return bill ? (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Bill Details</h3>
                  <p className="text-sm text-gray-500">Date: {new Date(bill.date).toLocaleDateString()}</p>
                </div>
                <button onClick={() => setSelectedBillId(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Bill Summary */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Items</p>
                      <p className="text-2xl font-bold text-gray-900">{bill.items.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Bill Amount</p>
                      <p className="text-2xl font-bold text-blue-600">₹{bill.totalAmount.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Amount Paid</p>
                      <p className="text-2xl font-bold text-green-600">₹{bill.amountPaid.toFixed(0)}</p>
                    </div>
                  </div>
                </div>

                {/* Bill Items Table */}
                <div>
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Package size={18} /> Items in Bill
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left">Product</th>
                          <th className="px-4 py-3 text-right">Quantity</th>
                          <th className="px-4 py-3 text-right">Price/Unit</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bill.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-gray-700">₹{item.price.toFixed(0)}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">₹{(item.quantity * item.price).toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bill Summary Section */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-bold text-gray-900">₹{bill.subTotal.toFixed(0)}</span>
                  </div>
                  {bill.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount:</span>
                      <span className="font-bold text-green-600">-₹{bill.discount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg border-t pt-2">
                    <span className="font-bold text-gray-900">Total Amount:</span>
                    <span className="font-bold text-blue-600">₹{bill.totalAmount.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span className="font-bold text-gray-900">Amount Paid:</span>
                    <span className="font-bold text-green-600">₹{bill.amountPaid.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-lg bg-red-50 p-2 rounded">
                    <span className="font-bold text-red-700">Still Due:</span>
                    <span className="font-bold text-red-600">₹{(bill.totalAmount - bill.amountPaid).toFixed(0)}</span>
                  </div>
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
        ) : null;
      })()}
    </div>
  );
};
