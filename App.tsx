
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Inventory } from './pages/Inventory';
import { Expenses } from './pages/Expenses';
import { Reports } from './pages/Reports';
import { SalesHistory } from './pages/SalesHistory';
import { Credits } from './pages/Credits';
import { Suppliers } from './pages/Suppliers';
import { Users } from './pages/Users';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { userRole } = useStore();
  if (!userRole) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { userRole } = useStore();
  if (userRole !== 'ADMIN') return <Navigate to="/pos" />; // Redirect staff to POS if they try to access admin pages
  return <>{children}</>;
};

const AppContent = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Dashboard is now shared (logic inside Dashboard handles role view) */}
      <Route path="/" element={
        <ProtectedRoute>
           <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/pos" element={
        <ProtectedRoute>
          <POS />
        </ProtectedRoute>
      } />
      
      <Route path="/inventory" element={
        <ProtectedRoute>
          <Inventory />
        </ProtectedRoute>
      } />
      
      <Route path="/expenses" element={
        <ProtectedRoute>
          <Expenses />
        </ProtectedRoute>
      } />

      {/* Shared Management Pages */}
      <Route path="/credits" element={
         <ProtectedRoute>
            <Credits />
        </ProtectedRoute>
      } />

      <Route path="/suppliers" element={
         <ProtectedRoute>
            <Suppliers />
        </ProtectedRoute>
      } />

      {/* STRICTLY ADMIN PAGES */}
      <Route path="/reports" element={
        <ProtectedRoute>
          <AdminRoute>
            <Reports />
          </AdminRoute>
        </ProtectedRoute>
      } />

      <Route path="/sales-history" element={
        <ProtectedRoute>
          <AdminRoute>
            <SalesHistory />
          </AdminRoute>
        </ProtectedRoute>
      } />

      <Route path="/users" element={
         <ProtectedRoute>
          <AdminRoute>
            <Users />
          </AdminRoute>
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </StoreProvider>
  );
}
