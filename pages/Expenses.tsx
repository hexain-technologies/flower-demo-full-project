
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../context/StoreContext';
import { Expense } from '../types';

export const Expenses = () => {
  const { expenses, addExpense, userName, userRole, bankAccounts, addBankTransaction } = useStore();
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('SHOP_EXPENSE');
  const [description, setDescription] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    const expenseObj = {
      id: uuidv4(),
      amount: Number(amount),
      category,
      description,
      date: new Date().toISOString().split('T')[0],
      createdBy: userName
    };

    addExpense(expenseObj);

    // If payment via bank, create a bank transaction OUT
    if (paymentMethod === 'BANK' && selectedBankId) {
      addBankTransaction({
        id: uuidv4(),
        bankAccountId: selectedBankId,
        amount: Number(amount),
        type: 'OUT',
        date: new Date().toISOString().split('T')[0],
        description: `Expense: ${category} - ${description}`,
        createdBy: userName
      });
    }

    setAmount('');
    setDescription('');
  };

  const filteredExpenses = expenses; // Could add date filtering here

  // Pagination Logic
  const totalPages = Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Add Expense Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Add Expense</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select 
              className="w-full border border-gray-300 rounded-lg p-2 outline-none"
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
            >
              <option value="SHOP_EXPENSE">Daily Shop Expense</option>
              <option value="TRANSPORT">Transport</option>
              <option value="OTHER">Other</option>
              {userRole === 'ADMIN' && (
                <>
                  <option value="SALARY">Staff Salary</option>
                  <option value="RENT">Shop Rent</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input 
              type="number"
              className="w-full border border-gray-300 rounded-lg p-2 outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select className="w-full border border-gray-300 rounded-lg p-2 outline-none" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
            </select>
          </div>

          {paymentMethod === 'BANK' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
              <select className="w-full border border-gray-300 rounded-lg p-2 outline-none" value={selectedBankId} onChange={e => setSelectedBankId(e.target.value)} required>
                <option value="">Select Bank Account...</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>{b.name} (₹{b.balance.toFixed(2)})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
              className="w-full border border-gray-300 rounded-lg p-2 outline-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button className="w-full bg-pink-600 text-white py-2 rounded-lg font-medium hover:bg-pink-700 transition-colors">
            Save Expense
          </button>
        </form>
      </div>

      {/* Expense List */}
      <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Expense History</h3>
          <span className="text-sm text-gray-500">Total: ₹{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</span>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedExpenses.map(exp => (
                <tr key={exp.id}>
                  <td className="px-6 py-3 text-gray-500">{exp.date}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-semibold">{exp.category}</span>
                  </td>
                  <td className="px-6 py-3">{exp.description}</td>
                  <td className="px-6 py-3 font-bold text-red-600">-₹{exp.amount}</td>
                  <td className="px-6 py-3 text-gray-500">{exp.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredExpenses.length)} of {filteredExpenses.length} expenses
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
              return pageNum <= totalPages ? (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
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
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
