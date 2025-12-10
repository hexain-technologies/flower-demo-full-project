
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../context/StoreContext';
import { StockBatch } from '../types';
import { PlusCircle, AlertTriangle, Trash2, Plus, Edit2 } from 'lucide-react';

interface PurchaseItemInput {
  productId: string;
  qty: number;
  costPrice: number;
  sellPrice: number;
}

export const Inventory = () => {
  const { stock, products, suppliers, addPurchase, getComputedStock, userRole, updateStockPrice, addProduct, addSupplierPayment, bankAccounts } = useStore();
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number | ''>('');
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showEditPriceModal, setShowEditPriceModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState('');
  const [editingNewPrice, setEditingNewPrice] = useState(0);
  const [editingCurrentPrice, setEditingCurrentPrice] = useState(0);
  const [editingError, setEditingError] = useState('');
  const [editingSuccess, setEditingSuccess] = useState(false);
  
  // Purchase Header State
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  
  // Purchase Items State
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemInput[]>([
    { productId: '', qty: 0, costPrice: 0, sellPrice: 0 }
  ]);

  const { newStock, oldStock, damagedStock } = getComputedStock();

  // --- Helpers for Dynamic Form ---

  const handleAddItem = () => {
    setPurchaseItems([...purchaseItems, { productId: '', qty: 0, costPrice: 0, sellPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const list = [...purchaseItems];
    list.splice(index, 1);
    setPurchaseItems(list);
  };

  const handleItemChange = (index: number, field: keyof PurchaseItemInput, value: any) => {
    const list = [...purchaseItems];
    const item = { ...list[index], [field]: value };
    
    // Auto-fill sell price if product changes
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        item.sellPrice = prod.defaultPrice;
      }
    }
    
    list[index] = item;
    setPurchaseItems(list);
  };

  const totalPurchaseCost = purchaseItems.reduce((acc, item) => acc + (item.qty * item.costPrice), 0);

  const handleOpenEditPriceModal = (productId: string, productName: string, currentPrice: number) => {
    if (userRole !== 'ADMIN') {
      alert('Only admins can edit prices');
      return;
    }
    setEditingProductId(productId);
    setEditingProductName(productName);
    setEditingCurrentPrice(currentPrice);
    setEditingNewPrice(currentPrice);
    setEditingError('');
    setEditingSuccess(false);
    setShowEditPriceModal(true);
  };

  const handleSubmitPriceEdit = async () => {
    if (!editingProductId) return;
    
    setEditingError('');
    setEditingSuccess(false);

    if (editingNewPrice <= 0) {
      setEditingError('Selling price must be greater than 0');
      return;
    }

    try {
      // Find all batches for this product and update them
      const batchesForProduct = stock.filter(b => b.productId === editingProductId);
      
      for (const batch of batchesForProduct) {
        await updateStockPrice(batch.id, editingNewPrice);
      }
      
      setEditingSuccess(true);
      setTimeout(() => {
        setShowEditPriceModal(false);
        setEditingProductId(null);
        setEditingProductName('');
        setEditingNewPrice(0);
        setEditingCurrentPrice(0);
      }, 1500);
    } catch (err: any) {
      setEditingError(err.message || 'Failed to update price');
    }
  };

  // --- Add Product From Purchase Row ---
  const handleCreateProduct = async () => {
    if (!newProdName || !newProdCategory || !newProdPrice) {
      alert('Please fill all product fields');
      return;
    }

    try {
      const created = await addProduct({ name: newProdName, category: newProdCategory, defaultPrice: Number(newProdPrice) });
      if (created) {
        // set selection on active row
        if (activeRowIndex !== null) {
          const list = [...purchaseItems];
          list[activeRowIndex].productId = created.id;
          list[activeRowIndex].sellPrice = created.defaultPrice;
          setPurchaseItems(list);
        }
        setShowAddProductModal(false);
        setActiveRowIndex(null);
        setNewProdName(''); setNewProdCategory(''); setNewProdPrice('');
      } else {
        alert('Failed to create product');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating product');
    }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (purchaseItems.some(i => !i.productId || i.qty <= 0)) {
      alert("Please ensure all items have a product and valid quantity selected.");
      return;
    }

    const supp = suppliers.find(s => s.id === selectedSupplier);

    // Loop through items and add them as batches
    purchaseItems.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return;

      const newBatch: StockBatch = {
        id: uuidv4(),
        productId: prod.id,
        productName: prod.name,
        quantity: Number(item.qty),
        purchasePrice: Number(item.costPrice),
        sellingPrice: Number(item.sellPrice),
        purchaseDate: new Date().toISOString().split('T')[0],
        originalQuantity: Number(item.qty),
        supplierId: selectedSupplier || undefined,
        supplierName: supp ? supp.name : undefined,
        paymentStatus: 'PAID',
        invoiceNo: invoiceNo || undefined
      };

      addPurchase(newBatch);
    });
    // Purchases are saved without creating supplier payments here.
    // Payment should be recorded separately via Supplier Payments UI.

    setShowPurchaseModal(false);

    // Reset form
    setPurchaseItems([{ productId: '', qty: 0, costPrice: 0, sellPrice: 0 }]);
    setSelectedSupplier('');
    setInvoiceNo('');
  };

  const StockTable = ({ title, data, colorClass }: { title: string, data: StockBatch[], colorClass: string }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <div className={`px-6 py-4 border-b border-gray-100 flex justify-between items-center ${colorClass} bg-opacity-10`}>
        <h3 className={`font-bold ${colorClass}`}>{title} ({data.length} Batches)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3">Qty</th>
              <th className="px-6 py-3">Cost</th>
              <th className="px-6 py-3">Sell Price</th>
              <th className="px-6 py-3">Supplier</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-400">No stock available</td></tr>
            ) : (
              data.map(batch => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">{batch.productName}</td>
                  <td className="px-6 py-3 font-bold">{batch.quantity}</td>
                  <td className="px-6 py-3">₹{batch.purchasePrice}</td>
                  <td className="px-6 py-3">₹{batch.sellingPrice}</td>
                  <td className="px-6 py-3 text-gray-600">{batch.supplierName || '-'}</td>
                  <td className="px-6 py-3 text-gray-500">{batch.purchaseDate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --- UNIFIED AGGREGATED STOCK VIEW ---
  const getAggregatedStock = (stockData: StockBatch[]) => {
    const aggregated: Record<string, {
      productName: string;
      totalQty: number;
      newQty: number;
      oldQty: number;
      damagedQty: number;
      avgCostPrice: number;
      avgSellPrice: number;
    }> = {};

    stockData.forEach(batch => {
      if (!aggregated[batch.productId]) {
        aggregated[batch.productId] = {
          productName: batch.productName,
          totalQty: 0,
          newQty: 0,
          oldQty: 0,
          damagedQty: 0,
          avgCostPrice: 0,
          avgSellPrice: 0
        };
      }

      aggregated[batch.productId].totalQty += batch.quantity;
      aggregated[batch.productId].avgCostPrice = batch.purchasePrice;
      aggregated[batch.productId].avgSellPrice = batch.sellingPrice;

      // Categorize by freshness
      const purchaseDate = new Date(batch.purchaseDate);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        aggregated[batch.productId].newQty += batch.quantity;
      } else if (daysDiff === 1) {
        aggregated[batch.productId].oldQty += batch.quantity;
      } else {
        aggregated[batch.productId].damagedQty += batch.quantity;
      }
    });

    return Object.values(aggregated);
  };

  const UnifiedStockTable = ({ allStock }: { allStock: StockBatch[] }) => {
    const aggregated = getAggregatedStock(allStock);

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="font-bold text-gray-800">Complete Inventory (Aggregated by Product)</h3>
          <p className="text-xs text-gray-600 mt-1">One row per product with smart quantity breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Total Qty</th>
                <th className="px-6 py-3">Qty Breakdown</th>
                <th className="px-6 py-3">Cost Price</th>
                <th className="px-6 py-3">Sell Price</th>
                <th className="px-6 py-3">Margin</th>
                {userRole === 'ADMIN' && <th className="px-6 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {aggregated.length === 0 ? (
                <tr><td colSpan={userRole === 'ADMIN' ? 7 : 6} className="px-6 py-4 text-center text-gray-400">No stock available</td></tr>
              ) : (
                aggregated.map(item => {
                  const margin = ((item.avgSellPrice - item.avgCostPrice) / item.avgCostPrice * 100).toFixed(0);
                  // Find productId from stock data for edit button
                  const stockBatch = allStock.find(b => b.productId === item.productName);
                  return (
                    <tr key={item.productName} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-bold text-gray-900">{item.productName}</td>
                      <td className="px-6 py-3">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold text-base">
                          {item.totalQty}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2 flex-wrap">
                          {item.newQty > 0 && (
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                              {item.newQty} New
                            </span>
                          )}
                          {item.oldQty > 0 && (
                            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-semibold">
                              {item.oldQty} Old
                            </span>
                          )}
                          {item.damagedQty > 0 && (
                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">
                              {item.damagedQty} Damaged
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-600">₹{item.avgCostPrice.toFixed(2)}</td>
                      <td className="px-6 py-3 text-gray-600">₹{item.avgSellPrice.toFixed(2)}</td>
                      <td className="px-6 py-3 font-bold text-green-600">{margin}%</td>
                      {userRole === 'ADMIN' && (
                        <td className="px-6 py-3">
                          <button
                            onClick={() => {
                              // Get the actual productId from the stock batch
                              const batch = allStock.find(b => b.productName === item.productName);
                              if (batch) {
                                handleOpenEditPriceModal(batch.productId, item.productName, item.avgSellPrice);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-xs hover:bg-blue-50 px-2 py-1 rounded"
                          >
                            <Edit2 size={14} />
                            Edit Price
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Inventory Management</h2>
        <button 
          onClick={() => setShowPurchaseModal(true)}
          className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
        >
          <PlusCircle size={20} />
          New Purchase
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <p className="text-green-800 font-semibold mb-1">New Stock</p>
          <p className="text-sm text-green-600">Purchased Today</p>
          <p className="text-2xl font-bold text-green-900 mt-2">{newStock.reduce((acc,b) => acc + b.quantity, 0)} Units</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
          <p className="text-yellow-800 font-semibold mb-1">Old Stock</p>
          <p className="text-sm text-yellow-600">Purchased Yesterday</p>
          <p className="text-2xl font-bold text-yellow-900 mt-2">{oldStock.reduce((acc,b) => acc + b.quantity, 0)} Units</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex justify-between items-start">
          <div>
            <p className="text-red-800 font-semibold mb-1">Damaged Stock</p>
            <p className="text-sm text-red-600">Older than 24hrs</p>
            <p className="text-2xl font-bold text-red-900 mt-2">{damagedStock.reduce((acc,b) => acc + b.quantity, 0)} Units</p>
          </div>
          <AlertTriangle className="text-red-400" />
        </div>
      </div>

      <UnifiedStockTable allStock={stock} />

      {/* Edit Price Modal */}
      {showEditPriceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Edit Selling Price</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <input 
                  type="text"
                  disabled
                  className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 text-gray-700"
                  value={editingProductName}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Price</label>
                <input 
                  type="number"
                  disabled
                  className="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50 text-gray-700"
                  value={editingCurrentPrice.toFixed(2)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Selling Price</label>
                <input 
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                  value={editingNewPrice || ''}
                  onChange={(e) => setEditingNewPrice(Number(e.target.value))}
                  autoFocus
                />
              </div>

              {editingError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {editingError}
                </div>
              )}

              {editingSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  ✓ Price updated successfully for all batches!
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button 
                onClick={() => setShowEditPriceModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitPriceEdit}
                disabled={editingSuccess}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingSuccess ? '✓ Updated' : 'Update Price'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Add New Product</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input className="w-full border border-gray-300 rounded-lg p-2.5" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input className="w-full border border-gray-300 rounded-lg p-2.5" value={newProdCategory} onChange={(e) => setNewProdCategory(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Selling Price</label>
                <input type="number" min="0" step="0.01" className="w-full border border-gray-300 rounded-lg p-2.5" value={newProdPrice as any} onChange={(e) => setNewProdPrice(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => { setShowAddProductModal(false); setActiveRowIndex(null); }} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreateProduct} className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Original Detailed Views (Optional - can keep for reference) */}
      <details className="mb-6">
        <summary className="cursor-pointer p-4 bg-gray-50 rounded-lg border border-gray-200 font-semibold text-gray-700 hover:bg-gray-100">
          📋 Detailed Stock Breakdown (by Batch)
        </summary>
        <div className="mt-4 space-y-4">
          <StockTable title="New Stock (Today)" data={newStock} colorClass="text-green-700" />
          <StockTable title="Old Stock (Yesterday)" data={oldStock} colorClass="text-yellow-700" />
          {userRole === 'ADMIN' && (
            <StockTable title="Damaged / Expired Stock" data={damagedStock} colorClass="text-red-700" />
          )}
        </div>
      </details>

      {/* Purchase Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-10">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl">
            <h3 className="text-xl font-bold mb-4">Add New Purchase Entry</h3>
            
            <form onSubmit={handlePurchase}>
              {/* Header Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none"
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {/* Payment UI removed: payment will be recorded separately in Supplier Payments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2 outline-none"
                    placeholder="e.g., INV-2025-001"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="mb-6">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3 rounded-tl-lg">Product</th>
                      <th className="p-3 w-24">Qty</th>
                      <th className="p-3 w-32">Cost Price</th>
                      <th className="p-3 w-32">Sell Price</th>
                      <th className="p-3 w-32 text-right">Total Cost</th>
                      <th className="p-3 w-10 rounded-tr-lg"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {purchaseItems.map((item, index) => (
                      <tr key={index}>
                        <td className="p-2">
                           <div className="flex items-center gap-2">
                             <select 
                              className="flex-1 border border-gray-300 rounded p-1.5 focus:ring-1 focus:ring-pink-500 outline-none"
                              value={item.productId}
                              onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                              required
                            >
                              <option value="">Select...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            <button type="button" title="Add New Product" onClick={() => { setActiveRowIndex(index); setShowAddProductModal(true); }} className="p-2 bg-gray-100 rounded hover:bg-gray-200">
                              <Plus size={16} />
                            </button>
                           </div>
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" min="1"
                            className="w-full border border-gray-300 rounded p-1.5 text-center outline-none"
                            value={item.qty || ''}
                            onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))}
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" min="0"
                            className="w-full border border-gray-300 rounded p-1.5 text-right outline-none"
                            value={item.costPrice || ''}
                            onChange={(e) => handleItemChange(index, 'costPrice', Number(e.target.value))}
                            required
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" min="0"
                            className="w-full border border-gray-300 rounded p-1.5 text-right outline-none"
                            value={item.sellPrice || ''}
                            onChange={(e) => handleItemChange(index, 'sellPrice', Number(e.target.value))}
                            required
                          />
                        </td>
                        <td className="p-2 text-right font-medium">
                          ₹{(item.qty * item.costPrice).toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          {purchaseItems.length > 1 && (
                            <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-600">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <button 
                  type="button" 
                  onClick={handleAddItem}
                  className="mt-3 text-sm text-pink-600 font-bold flex items-center gap-1 hover:text-pink-800"
                >
                  <Plus size={16} /> Add Another Product
                </button>
              </div>

              {/* Footer / Totals */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <div className="text-left">
                  <p className="text-sm text-gray-500">Total Purchase Amount</p>
                  <p className="text-2xl font-bold text-gray-800">₹{totalPurchaseCost.toFixed(2)}</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowPurchaseModal(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-bold shadow-md"
                  >
                    Confirm Purchase
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
