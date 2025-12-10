
import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../context/StoreContext';
import { StockBatch, CartItem, PaymentMode, Sale } from '../types';
import { ShoppingCart, Trash2, CheckCircle, AlertCircle, RefreshCw, UserPlus, Filter, Printer, X, DollarSign } from 'lucide-react';

export const POS = () => {
  const { stock, getStockStatus, addSale, userName, customers, addNewCustomer, deleteSale, userRole, bankAccounts } = useStore();
  const isAdmin = (userRole as any) === 'ADMIN';

  // If current user is ADMIN, do not show billing UI
  if (isAdmin) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-xl text-center">
          <h3 className="text-xl font-bold mb-2">Billing Disabled for Admins</h3>
          <p className="text-sm text-gray-600 mb-4">Administrators cannot create bills from the POS. Use Reports and Sales History to monitor activity.</p>
          <div className="flex justify-center gap-3">
            <Link to="/reports" className="px-4 py-2 bg-pink-600 text-white rounded-lg">Open Reports</Link>
            <Link to="/sales-history" className="px-4 py-2 border rounded-lg">Sales History</Link>
          </div>
        </div>
      </div>
    );
  }
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Stock Filter State
  const [stockFilter, setStockFilter] = useState<'ALL' | 'NEW' | 'OLD'>('ALL');

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(''); // '' means Walk-in
  
  // Billing State
  const [discount, setDiscount] = useState<string>(''); // Amount in Rupees
  
  // UI State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutPaymentMode, setCheckoutPaymentMode] = useState<PaymentMode>('CASH');
    const [checkoutBankAccountId, setCheckoutBankAccountId] = useState<string>('');
  
  // New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Checkout Calculation State
  const [tenderedAmount, setTenderedAmount] = useState<string>(''); // Cash received
  const [lastSale, setLastSale] = useState<Sale | null>(null); // For printing

  // 1. Filter Stock
  const availableStock = useMemo(() => {
    return stock.filter(batch => {
      const status = getStockStatus(batch);
      const isAvailable = batch.quantity > 0 && status !== 'DAMAGED';
      if (!isAvailable) return false;
      if (stockFilter === 'ALL') return true;
      if (stockFilter === 'NEW') return status === 'NEW';
      if (stockFilter === 'OLD') return status === 'OLD';
      return true;
    });
  }, [stock, getStockStatus, stockFilter]);

  // 2. Aggregate stock by product name and status
  const aggregatedStock = useMemo(() => {
    const aggregated: Record<string, {
      productName: string;
      productId: string;
      status: string;
      totalQty: number;
      price: number;
      batches: StockBatch[];
      displayKey: string;
    }> = {};

    availableStock.forEach(batch => {
      const status = getStockStatus(batch);
      const key = `${batch.productId}-${status}`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          productName: batch.productName,
          productId: batch.productId,
          status: status,
          totalQty: 0,
          price: batch.sellingPrice,
          batches: [],
          displayKey: key
        };
      }
      
      aggregated[key].totalQty += batch.quantity;
      aggregated[key].batches.push(batch);
    });

    return Object.values(aggregated);
  }, [availableStock, getStockStatus]);

  // --- Cart Actions ---
  const addToCart = (aggregatedItem: any) => {
    // Find the first batch with available space
    let batchToAdd: StockBatch | null = null;
    
    for (const batch of aggregatedItem.batches) {
      const cartItem = cart.find(item => item.stockBatchId === batch.id);
      const currentQtyInCart = cartItem?.quantity || 0;
      
      if (currentQtyInCart < batch.quantity) {
        batchToAdd = batch;
        break;
      }
    }

    if (!batchToAdd) return; // No available space in any batch

    setCart(prev => {
      const existing = prev.find(item => item.stockBatchId === batchToAdd!.id);
      if (existing) {
        return prev.map(item => 
          item.stockBatchId === batchToAdd!.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, {
        stockBatchId: batchToAdd!.id,
        productId: batchToAdd!.productId,
        productName: batchToAdd!.productName,
        quantity: 1,
        price: batchToAdd!.sellingPrice,
        status: getStockStatus(batchToAdd!)
      }];
    });
  };

  const removeFromCart = (batchId: string) => setCart(prev => prev.filter(item => item.stockBatchId !== batchId));

  // Remove all cart entries for a product+status (used by consolidated UI)
  const removeProductFromCart = (productId: string, status: string) => {
    setCart(prev => prev.filter(ci => {
      const sb = stock.find(s => s.id === ci.stockBatchId);
      return !(sb && sb.productId === productId && getStockStatus(sb) === status);
    }));
  };

  // Product-level quantity change: find any batch for the product+status and delegate
  const handleProductQuantityChange = (productId: string, status: string, value: string) => {
    const parsed = parseInt(value);
    if (isNaN(parsed)) return;
    // find a representative batch id for this product+status
    const rep = stock.find(b => b.productId === productId && getStockStatus(b) === status);
    if (!rep) return;
    // delegate to batch-level handler which redistributes across all batches
    handleQuantityChange(rep.id, value);
  };

  const handleQuantityChange = (batchId: string, value: string) => {
    const parsed = parseInt(value);
    if (isNaN(parsed)) return;

    const batch = stock.find(b => b.id === batchId);
    if (!batch) return;

    const productId = batch.productId;
    const status = getStockStatus(batch);

    // Gather all batches for this product+status
    const productBatches = stock.filter(b => b.productId === productId && getStockStatus(b) === status);

    // Compute current total in cart for this product/status
    const currentCartItems = cart.filter(ci => {
      const sb = stock.find(s => s.id === ci.stockBatchId);
      return sb && sb.productId === productId && getStockStatus(sb) === status;
    });
    const currentTotal = currentCartItems.reduce((s, i) => s + i.quantity, 0);

    // Max possible is sum of quantities across batches
    const maxPossible = productBatches.reduce((s, b) => s + b.quantity, 0);

    // Desired total across all batches (cap to available stock)
    const desiredTotal = Math.max(0, Math.min(parsed, maxPossible));

    if (desiredTotal === currentTotal) return; // nothing to do

    let newCart = [...cart];

    if (desiredTotal > currentTotal) {
      // Need to add items across batches (respect per-batch capacity)
      let need = desiredTotal - currentTotal;
      for (const b of productBatches) {
        if (need <= 0) break;
        const existing = newCart.find(ci => ci.stockBatchId === b.id);
        const existingQty = existing ? existing.quantity : 0;
        const avail = b.quantity - existingQty;
        if (avail <= 0) continue;
        const add = Math.min(avail, need);
        if (existing) {
          newCart = newCart.map(ci => ci.stockBatchId === b.id ? { ...ci, quantity: ci.quantity + add } : ci);
        } else {
          newCart.push({
            stockBatchId: b.id,
            productId: b.productId,
            productName: b.productName,
            quantity: add,
            price: b.sellingPrice,
            status: getStockStatus(b)
          });
        }
        need -= add;
      }
    } else {
      // Need to remove items (reduce across batches, remove from last batches first)
      let needToRemove = currentTotal - desiredTotal;
      // Order batches by cart presence (reverse order) to remove from newest/last
      const batchesInCart = currentCartItems.map(ci => stock.find(s => s.id === ci.stockBatchId)!).filter(Boolean);
      const ordered = batchesInCart.reverse();
      for (const b of ordered) {
        if (needToRemove <= 0) break;
        const existing = newCart.find(ci => ci.stockBatchId === b.id);
        if (!existing) continue;
        const removable = Math.min(existing.quantity, needToRemove);
        if (existing.quantity - removable <= 0) {
          newCart = newCart.filter(ci => ci.stockBatchId !== b.id);
        } else {
          newCart = newCart.map(ci => ci.stockBatchId === b.id ? { ...ci, quantity: ci.quantity - removable } : ci);
        }
        needToRemove -= removable;
      }
    }

    setCart(newCart);
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    const newId = uuidv4();
    addNewCustomer({ id: newId, name: newCustName, phone: newCustPhone, outstandingBalance: 0 });
    setSelectedCustomerId(newId);
    setShowAddCustomerModal(false);
    setNewCustName('');
    setNewCustPhone('');
  };

  // --- Totals ---
  const subTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountVal = Number(discount) || 0;
  const netTotal = Math.max(0, subTotal - discountVal);

  // --- Checkout Logic ---
  const initiateCheckout = (mode: PaymentMode) => {
    if (cart.length === 0) return;
    setCheckoutPaymentMode(mode);
    setTenderedAmount(''); // Reset
    // default bank account for UPI
    if (mode === 'UPI') {
      setCheckoutBankAccountId(bankAccounts && bankAccounts.length > 0 ? bankAccounts[0].id : '');
    } else {
      setCheckoutBankAccountId('');
    }
    setShowCheckoutModal(true);
  };

  const completeSale = () => {
    // Validation
    if (checkoutPaymentMode === 'CREDIT' && !selectedCustomerId) {
      alert('Please select a registered customer for Credit sales.');
      return;
    }

    const tendered = Number(tenderedAmount);
    
    // Logic for amountPaid based on mode
    let amountPaid = 0;
    let changeReturned = 0;

    if (checkoutPaymentMode === 'CASH') {
        if (tendered < netTotal) {
            alert("Tendered amount is less than Bill Total!");
            return;
        }
        amountPaid = netTotal;
        changeReturned = tendered - netTotal;
    } else if (checkoutPaymentMode === 'UPI') {
        // require bank account selection for UPI
        if (!checkoutBankAccountId) {
          alert('Please select a bank account to receive UPI payment.');
          return;
        }
        amountPaid = netTotal;
        changeReturned = 0;
    } else if (checkoutPaymentMode === 'CREDIT') {
        // Partial Payment Logic
        amountPaid = tendered; // User can pay 0 or part of it
        changeReturned = 0;
    }

    const customerObj = customers.find(c => c.id === selectedCustomerId);
    const finalCustomerName = customerObj ? customerObj.name : 'Walk-in Customer';

    const newSale: Sale = {
      id: uuidv4(),
      date: new Date().toISOString(),
      subTotal,
      discount: discountVal,
      totalAmount: netTotal,
      amountPaid,
      changeReturned,
      paymentMode: checkoutPaymentMode,
      customerId: selectedCustomerId || undefined,
      customerName: finalCustomerName,
      bankAccountId: checkoutPaymentMode === 'UPI' ? checkoutBankAccountId : undefined,
      items: cart,
      createdBy: userName
    };

    addSale(newSale);
    setLastSale(newSale); // Trigger for print/success view

    // Reset UI
    setCart([]);
    setSelectedCustomerId('');
    setDiscount('');
    setShowCheckoutModal(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6">
      {/* 1. PRODUCT GRID */}
      <div className="flex-1 overflow-auto pr-2 no-print">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
           <div>
             <h2 className="text-xl font-bold text-gray-800">Available Stock</h2>
             <p className="text-sm text-gray-500">Select items to add to bill</p>
           </div>
           
           <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
             <Filter size={16} className="text-gray-400" />
             <span className="text-sm font-semibold text-gray-700">Filter:</span>
             <select 
                className="bg-transparent text-sm outline-none font-medium cursor-pointer"
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
             >
               <option value="ALL">All Stock</option>
               <option value="NEW">New Stock</option>
               <option value="OLD">Old Stock</option>
             </select>
           </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {aggregatedStock.map(aggregated => {
              return (
                <div 
                  key={aggregated.displayKey} 
                  className={`bg-white p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg relative overflow-hidden ${aggregated.status === 'OLD' ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'}`}
                  onClick={() => addToCart(aggregated)}
                >
                  <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold text-white rounded-bl-lg ${aggregated.status === 'NEW' ? 'bg-green-600' : 'bg-yellow-600'}`}>
                    {aggregated.status}
                  </div>
                  <div className="mb-2 mt-2">
                    <h3 className="font-bold text-gray-800 text-lg leading-tight">{aggregated.productName}</h3>
                    <p className="text-xs text-gray-500 mt-1">{aggregated.batches.length} batch{aggregated.batches.length !== 1 ? 'es' : ''}</p>
                  </div>
                  <div className="flex justify-between items-end mt-4">
                    <div><p className="text-xs text-gray-500">Avail: {aggregated.totalQty}</p></div>
                    <p className="text-pink-600 font-bold text-xl">₹{aggregated.price}</p>
                  </div>
                </div>
              );
          })}
        </div>
      </div>

      {/* 2. CART SIDEBAR */}
      <div className="w-96 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-full no-print">
        <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-pink-600" />
            <h3 className="font-bold text-lg">Current Bill</h3>
          </div>
          <div className="relative">
             <label className="text-xs font-bold text-gray-500 mb-1 block">Customer</label>
             <div className="flex gap-2">
               <select 
                 className="flex-1 p-2 border rounded-lg text-sm outline-none focus:ring-2 border-gray-300 focus:ring-pink-500"
                 value={selectedCustomerId}
                 onChange={(e) => setSelectedCustomerId(e.target.value)}
               >
                 <option value="">Walk-in Customer</option>
                 {customers.map(c => (
                   <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                 ))}
               </select>
               <button onClick={() => setShowAddCustomerModal(true)} className="bg-pink-100 text-pink-600 p-2 rounded-lg hover:bg-pink-200"><UserPlus size={18} /></button>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
               <RefreshCw size={32} className="mx-auto mb-2 opacity-20" />
               <p>Select items to begin</p>
            </div>
          ) : (
            // Consolidate cart lines by productId + status
            (() => {
              const grouped: Record<string, { productId: string; productName: string; status: string; totalQty: number; totalPrice: number; unitPrice: number }> = {};
              cart.forEach(ci => {
                const sb = stock.find(s => s.id === ci.stockBatchId);
                if (!sb) return;
                const key = `${sb.productId}|${getStockStatus(sb)}`;
                if (!grouped[key]) {
                  grouped[key] = { productId: sb.productId, productName: sb.productName, status: getStockStatus(sb), totalQty: 0, totalPrice: 0, unitPrice: ci.price };
                }
                grouped[key].totalQty += ci.quantity;
                grouped[key].totalPrice += ci.quantity * ci.price;
              });

              return Object.values(grouped).map(g => (
                <div key={g.productId + '|' + g.status} className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-sm text-gray-800">{g.productName}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-gray-200 text-gray-600">{g.status}</span>
                    </div>
                    <button onClick={() => removeProductFromCart(g.productId, g.status)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex justify-between items-center">
                     <div className="flex items-center gap-2">
                       <label className="text-xs text-gray-500">Qty:</label>
                       <input type="number" min="1" className="w-20 p-1 text-center text-sm font-bold border rounded outline-none" 
                         value={g.totalQty} onChange={(e) => handleProductQuantityChange(g.productId, g.status, e.target.value)} />
                     </div>
                     <p className="text-sm font-bold text-gray-800">₹{g.totalPrice.toFixed(2)}</p>
                  </div>
                  {/* optional: show breakdown per batch */}
                </div>
              ));
            })()
          )}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Sub Total</span>
            <span className="font-medium">₹{subTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
             <span className="text-gray-500">Discount (₹)</span>
             <input 
               type="number" 
               className="w-20 p-1 text-right border rounded outline-none focus:ring-1 focus:ring-pink-500"
               placeholder="0"
               value={discount}
               onChange={(e) => setDiscount(e.target.value)}
             />
          </div>
          <div className="flex justify-between text-xl font-bold border-t pt-2 border-dashed">
            <span>Total</span>
            <span>₹{netTotal.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['CASH', 'UPI', 'CREDIT'] as PaymentMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => initiateCheckout(mode)}
                disabled={cart.length === 0}
                className={`py-2 text-xs font-bold rounded-lg border transition-all ${cart.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 active:scale-95'} 
                  ${mode === 'CASH' ? 'border-green-200 text-green-700 bg-green-50' : 
                    mode === 'UPI' ? 'border-purple-200 text-purple-700 bg-purple-50' : 'border-red-200 text-red-700 bg-red-50'}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. CHECKOUT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
             <div className="bg-pink-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg">Checkout: {checkoutPaymentMode}</h3>
                <button onClick={() => setShowCheckoutModal(false)}><X size={20}/></button>
             </div>
             
             <div className="p-6 space-y-6">
                <div className="text-center">
                   <p className="text-gray-500 text-sm">Net Payable Amount</p>
                   <h2 className="text-4xl font-bold text-gray-900">₹{netTotal.toFixed(2)}</h2>
                </div>

                {/* Change / Partial Payment Logic */}
                  {checkoutPaymentMode !== 'UPI' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {checkoutPaymentMode === 'CREDIT' ? 'Initial Payment (Optional)' : 'Cash Tendered'}
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="number"
                        autoFocus
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl text-lg font-bold outline-none focus:border-pink-500"
                        value={tenderedAmount}
                        onChange={(e) => setTenderedAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                {checkoutPaymentMode === 'UPI' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Bank Account</label>
                    <select
                      className="w-full p-2 border rounded-lg"
                      value={checkoutBankAccountId}
                      onChange={(e) => setCheckoutBankAccountId(e.target.value)}
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts && bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.accountNumber})</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">UPI receipts will be credited to the selected bank.</p>
                  </div>
                )}

                {/* Display Balance / Change */}
                {checkoutPaymentMode === 'CASH' && tenderedAmount && (
                   <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Return Change</span>
                      <span className={`text-xl font-bold ${Number(tenderedAmount) - netTotal < 0 ? 'text-red-500' : 'text-green-600'}`}>
                        ₹{(Number(tenderedAmount) - netTotal).toFixed(2)}
                      </span>
                   </div>
                )}

                {checkoutPaymentMode === 'CREDIT' && (
                   <div className="bg-red-50 p-4 rounded-lg flex justify-between items-center">
                      <span className="text-red-700 font-medium">Added to Debt</span>
                      <span className="text-xl font-bold text-red-700">
                        ₹{Math.max(0, netTotal - Number(tenderedAmount)).toFixed(2)}
                      </span>
                   </div>
                )}

                <button 
                  onClick={completeSale}
                  className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-green-700 transition-transform active:scale-95"
                >
                  Confirm & Print
                </button>
             </div>
          </div>
        </div>
      )}

      {/* 4. SUCCESS / PRINT POPUP */}
      {lastSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
           <div className="bg-white p-6 rounded-xl text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                 <CheckCircle size={32} />
              </div>
              <h2 className="text-2xl font-bold">Sale Completed!</h2>
                <div className="flex gap-3 justify-center">
                <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900">
                  <Printer size={18} /> Print Bill
                </button>
                <button onClick={() => setLastSale(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  New Sale
                </button>
                {isAdmin && lastSale && (
                 <button
                  onClick={() => {
                    if (window.confirm('Delete this bill? This will restore stock and revert balances.')) {
                     deleteSale(lastSale.id);
                     setLastSale(null);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                 >
                  Remove Bill
                 </button>
                )}
              </div>
           </div>
        </div>
      )}

      {/* 5. ADD CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="text-lg font-bold mb-4">Add New Customer</h3>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <input type="text" required autoFocus className="w-full border p-2 rounded-lg" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Name" />
              <input type="tel" className="w-full border p-2 rounded-lg" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="Phone" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="flex-1 py-2 border rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-pink-600 text-white rounded-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. HIDDEN PRINT RECEIPT TEMPLATE */}
      {lastSale && (
        <div id="receipt-print-area">
           <div className="font-mono text-sm text-black">
                <div className="text-center mb-4 border-b pb-2 border-black">
                  <h1 className="text-lg font-bold">Flora Flower</h1>
                  <p className="text-xs">Ernakulam, Kerala</p>
                  <p className="text-xs">Phone: 7356510755</p>
                </div>
              
              <div className="mb-2 text-xs">
                 <p>Bill #: {lastSale.id.toUpperCase()}</p>
                 <p>Date: {new Date(lastSale.date).toLocaleString()}</p>
                 <p>Customer: {lastSale.customerName}</p>
                 <p>Staff: {lastSale.createdBy}</p>
              </div>

              <table className="w-full text-left mb-2 text-xs border-b border-black">
                 <thead>
                   <tr>
                      <th className="py-1">Item</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Amt</th>
                   </tr>
                 </thead>
                 <tbody>
                   {
                     // Group sale items by productId (or productName) to show combined qty on print
                     (() => {
                       const grouped: Record<string, { productName: string; totalQty: number; totalAmt: number }> = {};
                       lastSale.items.forEach(it => {
                         const key = it.productId || it.productName;
                         if (!grouped[key]) grouped[key] = { productName: it.productName, totalQty: 0, totalAmt: 0 };
                         grouped[key].totalQty += it.quantity;
                         grouped[key].totalAmt += it.quantity * (it.price || 0);
                       });
                       return Object.values(grouped).map((g, idx) => (
                         <tr key={idx}>
                           <td className="py-1">{g.productName}</td>
                           <td className="py-1 text-center">{g.totalQty}</td>
                           <td className="py-1 text-right">{g.totalAmt.toFixed(2)}</td>
                         </tr>
                       ));
                     })()
                   }
                 </tbody>
              </table>

              <div className="text-right space-y-1 text-xs mb-4">
                 <p>Sub Total: {lastSale.subTotal.toFixed(2)}</p>
                 {lastSale.discount > 0 && <p>Discount: -{lastSale.discount.toFixed(2)}</p>}
                 <p className="font-bold text-sm">NET TOTAL: {lastSale.totalAmount.toFixed(2)}</p>
              </div>

              <div className="border-t border-black pt-2 text-xs">
                 <p>Mode: {lastSale.paymentMode}</p>
                 {lastSale.amountPaid > 0 && <p>Paid: {lastSale.amountPaid.toFixed(2)}</p>}
                 {lastSale.changeReturned > 0 && <p>Change: {lastSale.changeReturned.toFixed(2)}</p>}
                 {lastSale.paymentMode === 'CREDIT' && (
                    <p className="mt-1 font-bold">Balance Added: {(lastSale.totalAmount - lastSale.amountPaid).toFixed(2)}</p>
                 )}
              </div>
              
              <div className="text-center mt-6 text-xs">
                 <p>Thank you for shopping with us!</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
