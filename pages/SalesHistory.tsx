
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Trash2, Search, Calendar, Filter } from 'lucide-react';

export const SalesHistory = () => {
  const { sales, deleteSale, userRole } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const filteredSales = sales.filter(sale => {
    const matchesSearch = sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sale.id.includes(searchTerm);
    const matchesDate = filterDate ? sale.date.startsWith(filterDate) : true;
    return matchesSearch && matchesDate;
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this bill? Stock will be restored and credits reverted.')) {
      deleteSale(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Sales History</h2>
        
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search Bill # or Customer" 
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <input 
            type="date" 
            className="px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3">Bill ID</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Items</th>
                <th className="px-6 py-3">Mode</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Sold By</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400">No sales found matching your filters.</td>
                </tr>
              ) : (
                filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50 group">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">#{sale.id.toUpperCase()}</td>
                    <td className="px-6 py-4">{new Date(sale.date).toLocaleString()}</td>
                    <td className="px-6 py-4 font-medium">{sale.customerName || 'Walk-in'}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {sale.items.map(i => i.productName).join(', ').substring(0, 30)}
                      {sale.items.length > 1 ? '...' : ''}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        sale.paymentMode === 'CREDIT' ? 'bg-red-100 text-red-700' :
                        sale.paymentMode === 'UPI' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {sale.paymentMode}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">₹{sale.totalAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-500">{sale.createdBy}</td>
                    <td className="px-6 py-4 text-right">
                      {userRole === 'ADMIN' ? (
                        <button 
                          onClick={() => handleDelete(sale.id)}
                          className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"
                          title="Delete Bill"
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Admin only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
