import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Flower, Lock, User as UserIcon, AlertCircle } from 'lucide-react';

export const Login = () => {
  const { login, userRole } = useStore();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Automatically redirect if userRole is already set
  useEffect(() => {
    if (userRole === 'ADMIN') {
      navigate('/', { replace: true });
    } else if (userRole === 'SALES_STAFF') {
      navigate('/pos', { replace: true });
    }
  }, [userRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    try {
      const success = await login(cleanUsername, cleanPassword);
      if (!success) {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('Connection failed. Is backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-green-600 p-8 text-center">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Flower className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">FloraManager</h1>
          <p className="text-green-100">Inventory & Shop System</p>
        </div>
        
        <div className="p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Welcome Back</h2>
          
          <form onSubmit={handleSubmit} className="space-y-5">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
               <div className="relative">
                 <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                 <input 
                   type="text" 
                   required
                   className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                   placeholder="Enter username"
                   value={username}
                   onChange={(e) => setUsername(e.target.value)}
                 />
               </div>
             </div>

             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
               <div className="relative">
                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                 <input 
                   type="password" 
                   required
                   className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                   placeholder="••••••••"
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                 />
               </div>
             </div>

             {error && (
               <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                 <AlertCircle size={16} />
                 {error}
               </div>
             )}

             <button 
               type="submit"
               disabled={isLoading}
               className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 disabled:bg-gray-400"
             >
               {isLoading ? 'Connecting...' : 'Sign In'}
             </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-400">
             <p>Default Admin: admin / admin123</p>
             <p>Default Staff: staff / staff123</p>
          </div>
        </div>
      </div>
    </div>
  );
};