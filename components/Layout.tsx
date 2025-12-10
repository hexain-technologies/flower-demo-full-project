import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Wallet, 
  FileText, 
  LogOut, 
  CreditCard,
  Flower,
  History,
  Truck,
  Users
} from 'lucide-react';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { userRole, logout, userName } = useStore();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path ? "bg-green-100 text-green-700" : "text-gray-600 hover:bg-gray-50";

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 flex items-center gap-2 border-b border-gray-100">
          <div className="bg-green-600 p-2 rounded-lg">
            <Flower className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">FloraManager</h1>
            <p className="text-xs text-gray-500">Shop System</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Dashboard is now available to everyone (Conditional View) */}
          <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/')}`}>
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </Link>

          {userRole !== 'ADMIN' && (
            <Link to="/pos" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/pos')}`}>
              <ShoppingCart size={20} />
              <span className="font-medium">Billing (POS)</span>
            </Link>
          )}

          <Link to="/inventory" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/inventory')}`}>
            <Package size={20} />
            <span className="font-medium">Inventory & Stock</span>
          </Link>

          <Link to="/expenses" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/expenses')}`}>
            <Wallet size={20} />
            <span className="font-medium">Expenses</span>
          </Link>

          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Management
          </div>
          
          {/* Supplier & Credits opened to Staff for Payments */}
          <Link to="/suppliers" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/suppliers')}`}>
            <Truck size={20} />
            <span className="font-medium">Suppliers</span>
          </Link>
          
          <Link to="/credits" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/credits')}`}>
            <CreditCard size={20} />
            <span className="font-medium">Customer Credits</span>
          </Link>

          {/* Admin Only Links */}
          {userRole === 'ADMIN' && (
            <>
              <Link to="/sales-history" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/sales-history')}`}>
                <History size={20} />
                <span className="font-medium">Sales History</span>
              </Link>
              <Link to="/users" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/users')}`}>
                <Users size={20} />
                <span className="font-medium">Staff & Users</span>
              </Link>
              <Link to="/reports" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/reports')}`}>
                <FileText size={20} />
                <span className="font-medium">Reports</span>
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 p-3 rounded-lg mb-3">
            <p className="text-sm font-semibold text-gray-800">{userName}</p>
            <p className="text-xs text-gray-500">{userRole === 'ADMIN' ? 'Administrator' : 'Sales Staff'}</p>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 w-full px-2 py-2 text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};