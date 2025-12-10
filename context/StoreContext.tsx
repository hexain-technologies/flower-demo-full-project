import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product, StockBatch, Sale, Expense, UserRole, StockStatus, Customer, Supplier, SupplierPayment, User, CustomerPayment, CashAdjustment, BankAccount, BankTransaction } from '../types';
import { api } from '../services/api';

interface StoreContextType {
  userRole: UserRole | null;
  userName: string;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  
  products: Product[];
  stock: StockBatch[];
  sales: Sale[];
  expenses: Expense[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  users: User[];
  cashAdjustments: CashAdjustment[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  bankSummary: {
    openingIn: number;
    upiIn: number;
    totalIn: number;
    totalOut: number;
    supplierOut: number;
    expensesOut: number;
    computedBalance: number;
    accountBalances: number;
    perAccount?: Array<{
      bankAccountId: string;
      name: string;
      accountNumber?: string;
      accountBalance: number;
      opening: number;
      upiIn: number;
      totalIn: number;
      totalOut: number;
      supplierOut: number;
      expensesOut: number;
      computedBalance: number;
    }>
    openingFromDaybook?: number;
    computedBalanceWithOpening?: number;
  } | null;
  
  addSale: (sale: Sale) => void;
  addPurchase: (batch: StockBatch) => void;
  addExpense: (expense: Expense) => void;
  deleteSale: (saleId: string) => void; 
  addCustomerPayment: (customerId: string, amount: number, paymentMethod?: string, bankAccountId?: string) => void;
  addNewCustomer: (customer: Customer) => void;
  addSupplier: (supplier: Supplier) => void;
  addSupplierPayment: (payment: SupplierPayment) => void;
  addUser: (user: User) => void;
  updateUser: (user: User) => void;
  deleteUser: (userId: string) => Promise<void>;
  addCashAdjustment: (adj: CashAdjustment) => void;
  updateStockPrice: (stockBatchId: string, newPrice: number) => Promise<void>;
  addBankAccount: (account: BankAccount) => void;
  updateBankAccount: (account: BankAccount) => void;
  addBankTransaction: (tx: BankTransaction) => void;
  addProduct: (product: { name: string; category: string; defaultPrice: number }) => Promise<Product | null>;
  
  getStockStatus: (batch: StockBatch) => StockStatus;
  getComputedStock: () => { newStock: StockBatch[], oldStock: StockBatch[], damagedStock: StockBatch[] };
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    return (localStorage.getItem('flora_userRole') as UserRole) || null;
  });
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('flora_userName') || '';
  });
  
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockBatch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cashAdjustments, setCashAdjustments] = useState<CashAdjustment[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [bankSummary, setBankSummary] = useState<any>(null);

  // Initial load
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    await api.fetchAll();
    // Update local state from the API client cache
    setProducts(api.getProducts());
    setStock(api.getStock());
    setSales(api.getSales());
    setExpenses(api.getExpenses());
    setCustomers(api.getCustomers());
    setCustomerPayments(api.getCustomerPayments());
    setSuppliers(api.getSuppliers());
    setSupplierPayments(api.getSupplierPayments());
    setUsers(api.getUsers());
    setCashAdjustments(api.getCashAdjustments());
    setBankAccounts(api.getBankAccounts());
    setBankTransactions(api.getBankTransactions());
    try {
      const summary = await api.getBankSummary();
      setBankSummary(summary);
    } catch (e) {
      console.warn('Failed to fetch bank summary', e);
      setBankSummary(null);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const user = await api.authenticate(username, password);
    if (user) {
      setUserRole(user.role);
      setUserName(user.name);
      localStorage.setItem('flora_userRole', user.role);
      localStorage.setItem('flora_userName', user.name);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await api.logoutUser();
    setUserRole(null);
    setUserName('');
    localStorage.removeItem('flora_userRole');
    localStorage.removeItem('flora_userName');
    localStorage.removeItem('flora_accessToken');
    localStorage.removeItem('flora_refreshToken');
  };

  const addSale = async (newSale: Sale) => {
    await api.createSale(newSale);
    refreshData();
  };

  const addPurchase = async (batch: StockBatch) => {
    await api.createPurchase(batch);
    refreshData();
  };

  const addExpense = async (expense: Expense) => {
    await api.createExpense(expense);
    refreshData();
  };

  const deleteSale = async (saleId: string) => {
    if (userRole !== 'ADMIN') return;
    await api.deleteSale(saleId, userRole);
    refreshData();
  };

  const addCustomerPayment = async (customerId: string, amount: number, paymentMethod?: string, bankAccountId?: string) => {
    await api.addCustomerPayment(customerId, amount, userName, paymentMethod, bankAccountId);
    refreshData();
  };
  
  const addNewCustomer = async (customer: Customer) => {
    await api.createCustomer(customer);
    refreshData();
  };

  const addSupplier = async (supplier: Supplier) => {
    await api.addSupplier(supplier);
    refreshData();
  };

  const addSupplierPayment = async (payment: SupplierPayment) => {
    await api.addSupplierPayment(payment);
    refreshData();
  };

  const addUser = async (user: User) => {
    await api.createUser(user);
    refreshData();
  };

  const updateUser = async (user: User) => {
    await api.updateUser(user);
    refreshData();
  };

  const deleteUser = async (userId: string) => {
    await api.deleteUser(userId);
    refreshData();
  };

  const addCashAdjustment = async (adj: CashAdjustment) => {
    await api.addCashAdjustment(adj);
    refreshData();
  }

  const addBankAccount = async (account: BankAccount) => {
    await api.createBankAccount(account);
    refreshData();
  }

  const updateBankAccount = async (account: BankAccount) => {
    await api.updateBankAccount(account);
    refreshData();
  }

  const addBankTransaction = async (tx: BankTransaction) => {
    await api.createBankTransaction(tx);
    refreshData();
  }

  const addProduct = async (product: { name: string; category: string; defaultPrice: number }) => {
    const created = await api.createProduct(product);
    if (created) {
      // Refresh products to ensure consistency
      await refreshData();
      return created;
    }
    return null;
  }

  const updateStockPrice = async (stockBatchId: string, newPrice: number) => {
    try {
      const res = await fetch(`/api/stock/${stockBatchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellingPrice: newPrice })
      });
      if (!res.ok) throw new Error('Failed to update stock price');
      // Refresh stock data to reflect the change
      await refreshData();
    } catch (err) {
      console.error('updateStockPrice error', err);
      throw err;
    }
  };

  const getStockStatus = (batch: StockBatch) => {
    return api.getStockStatusForBatch(batch);
  };

  const getComputedStock = () => {
    return api.getComputedStock();
  };

  return (
    <StoreContext.Provider value={{
      userRole, userName, login, logout,
      products, stock, sales, expenses, customers, customerPayments, suppliers, supplierPayments, users, cashAdjustments,
      addSale, addPurchase, addExpense, deleteSale, addCustomerPayment, addNewCustomer, addSupplier, addSupplierPayment, addUser, updateUser, deleteUser, addCashAdjustment, updateStockPrice, addProduct,
      bankAccounts, bankTransactions, addBankAccount, updateBankAccount, addBankTransaction,
      bankSummary,
      getStockStatus, getComputedStock
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
