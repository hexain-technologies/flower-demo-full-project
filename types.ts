
export type UserRole = 'ADMIN' | 'SALES_STAFF';

export type PaymentMode = 'CASH' | 'UPI' | 'BANK' | 'CREDIT' | 'CAN' | 'HIDE' | 'NOT_USE';

export type StockStatus = 'NEW' | 'OLD' | 'DAMAGED';

export interface User {
  id: string;
  username: string;
  password?: string; // In a real app, never store plain text
  name: string;
  role: UserRole;
}

export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
  category: string;
}

export interface BankAccount {
  id: string;
  name: string; // e.g., 'HDFC Current', 'Bank of India - UPI'
  accountNumber?: string;
  ifsc?: string;
  balance: number; // current balance
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  amount: number;
  type: 'IN' | 'OUT'; // IN = deposit/collections, OUT = expense/payment
  // Category helps aggregate transactions reliably (OPENING, UPI, SUPPLIER, EXPENSE, OTHER)
  category?: 'OPENING' | 'UPI' | 'SUPPLIER' | 'EXPENSE' | 'OTHER';
  date: string; // ISO date
  description?: string;
  createdBy?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  outstandingBalance: number; // Amount we owe them
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  date: string; // ISO Date YYYY-MM-DD
  note: string;
  createdBy?: string;
  // Optional: how the supplier was paid for this payment
  paymentMode?: PaymentMode;
  bankAccountId?: string;
  // If true, this supplier payment should be hidden from Day Book listings
  hideFromDaybook?: boolean;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  amount: number;
  date: string;
  createdBy?: string; 
  paymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'CHEQUE';
  bankAccountId?: string; // optional, used when paymentMethod is UPI/BANK
}

export interface StockBatch {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  purchasePrice: number; // Cost per unit
  sellingPrice: number;
  purchaseDate: string; // ISO Date string YYYY-MM-DD
  originalQuantity: number;
  supplierId?: string;
  supplierName?: string;
  paymentStatus?: 'PAID' | 'CREDIT';
  invoiceNo?: string; // Invoice/Bill Number for grouping
}

export interface CartItem {
  stockBatchId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  status: StockStatus;
}

export interface Sale {
  id: string;
  date: string; // ISO string with time
  subTotal: number;
  discount: number;
  totalAmount: number; // Final amount after discount
  amountPaid: number; // How much customer actually paid now
  changeReturned: number; // For cash sales
  paymentMode: PaymentMode;
  customerId?: string; // Link to specific customer
  customerName?: string;
  bankAccountId?: string;
  items: CartItem[];
  createdBy: string; // Staff Name
}

export interface Expense {
  id: string;
  category: 'SALARY' | 'RENT' | 'SHOP_EXPENSE' | 'TRANSPORT' | 'OTHER';
  amount: number;
  description: string;
  date: string;
  createdBy: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  outstandingBalance: number;
}

export interface DayBookEntry {
  type: 'SALE' | 'EXPENSE' | 'PURCHASE';
  description: string;
  amount: number; // Positive for income, negative for expense
  mode: string;
  time: string;
}

export interface StaffActivity {
  id: string;
  time: string; // ISO string
  type: 'SALE' | 'EXPENSE' | 'CUST_PAYMENT' | 'SUPP_PAYMENT' | 'PURCHASE';
  description: string;
  amount: number; // Raw amount
  isIncome: boolean; // True if money came in, False if money went out
  mode: string; // Cash, UPI, Credit
}

export interface CashAdjustment {
  id: string;
  amount: number;
  description: string; // e.g., "Opening Balance", "Cash Withdrawal"
  date: string; // ISO String
  type: 'ADD' | 'REMOVE'; // ADD = Opening Balance/Inject, REMOVE = Withdraw
  createdBy: string;
}

