
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../context/StoreContext';
import { User, UserRole } from '../types';
import { Users as UsersIcon, Plus, ShieldCheck, User as UserIcon, Edit2, Trash2 } from 'lucide-react';

export const Users = () => {
  const { users, addUser, updateUser, deleteUser } = useStore();
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [isEditMode, setIsEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('SALES_STAFF');

  const openAddModal = () => {
    setIsEditMode(false);
    setEditUserId(null);
    setName('');
    setUsername('');
    setPassword('');
    setRole('SALES_STAFF');
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setIsEditMode(true);
    setEditUserId(user.id);
    setName(user.name);
    setUsername(user.username);
    setPassword(user.password || ''); // Prefill password if available (mock mode) or leave blank
    setRole(user.role);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username) return;

    if (isEditMode && editUserId) {
        const updatedUser: User = {
            id: editUserId,
            name,
            username,
            role,
            password: password
        };
        updateUser(updatedUser);
    } else {
        if (!password) {
            alert("Password is required for new users");
            return;
        }
        const newUser: User = {
            id: uuidv4(),
            name,
            username,
            password,
            role
        };
        addUser(newUser);
    }

    setShowModal(false);
  };

  const handleDeleteUser = async (user: User) => {
    if (confirm(`Are you sure you want to deactivate ${user.name}? They will no longer be able to log in.`)) {
      try {
        await deleteUser(user.id);
        alert('User deactivated successfully');
      } catch (error) {
        alert('Failed to deactivate user');
        console.error(error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
        <button 
          onClick={openAddModal}
          className="bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-pink-700 transition-colors"
        >
          <Plus size={18} /> Add New User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3">Full Name</th>
                <th className="px-6 py-3">Username</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3 text-right">Status</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className={`p-2 rounded-full ${user.role === 'ADMIN' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      {user.role === 'ADMIN' ? <ShieldCheck size={16} /> : <UserIcon size={16} />}
                    </div>
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.username}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'ADMIN' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                      {user.role === 'ADMIN' ? 'Administrator' : 'Sales Staff'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-green-600 text-xs font-bold px-2 py-1 bg-green-50 rounded">Active</span>
                  </td>
                  <td className="px-6 py-4 text-center space-x-2 flex justify-center">
                     <button 
                        onClick={() => openEditModal(user)}
                        className="p-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                        title="Edit User"
                     >
                        <Edit2 size={16} />
                     </button>
                     <button 
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deactivate User"
                     >
                        <Trash2 size={16} />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <UsersIcon size={20} className="text-pink-600" />
                {isEditMode ? 'Edit User Details' : 'Add New Staff Member'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-pink-500"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Sarah Jones"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username (Login ID)</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-pink-500"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. sarah"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-pink-500"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isEditMode ? "Leave blank to keep unchanged" : "Set a password"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none"
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                >
                  <option value="SALES_STAFF">Sales Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-pink-600 text-white rounded-lg font-bold hover:bg-pink-700"
                >
                  {isEditMode ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
