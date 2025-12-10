const mongoose = require('mongoose');

// 1. Users
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'SALES_STAFF'], required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: null }
});

// 2. Products
const ProductSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  defaultPrice: { type: Number, required: true },
  category: { type: String, required: true }
});

// 3. Stock
const StockSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  productId: String,
  productName: String,
  quantity: Number,
  purchasePrice: Number,
  sellingPrice: Number,
  purchaseDate: String, // ISO String
  originalQuantity: Number,
  supplierId: String,
  supplierName: String,
  paymentStatus: String,
  invoiceNo: String // Invoice/Bill Number for grouping purchases
});

// 4. Sales (Embeds Items directly - No need for separate table)
const SaleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  date: String,
  subTotal: Number,
  discount: Number,
  totalAmount: Number,
  amountPaid: Number,
  changeReturned: Number,
  paymentMode: String,
  customerId: String,
  customerName: String,
  createdBy: String,
  items: [{
    stockBatchId: String,
    productId: String,
    productName: String,
    quantity: Number,
    price: Number,
    status: String
  }]
});

// 5. Expenses
const ExpenseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  category: String,
  amount: Number,
  description: String,
  date: String,
  createdBy: String
});

// 6. Customers
const CustomerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  phone: String,
  outstandingBalance: { type: Number, default: 0 }
});

// 7. Customer Payments
const CustomerPaymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  customerId: String,
  amount: Number,
  date: String,
  createdBy: String
  ,paymentMethod: { type: String, enum: ['CASH','UPI','CARD','BANK','CHEQUE'], default: 'CASH' },
  bankAccountId: String
});

// 8. Suppliers
const SupplierSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  contact: String,
  outstandingBalance: { type: Number, default: 0 }
});

// 9. Supplier Payments
const SupplierPaymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  supplierId: String,
  amount: Number,
  date: String,
  note: String,
  createdBy: String,
  // Payment metadata
  paymentMode: { type: String },
  bankAccountId: String,
  hideFromDaybook: { type: Boolean, default: false }
});

// 10. Cash Adjustments (Daybook)
const CashAdjustmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  amount: Number,
  description: String,
  date: String,
  type: { type: String, enum: ['ADD', 'REMOVE'] },
  createdBy: String
});

// 11. Bank Accounts
const BankAccountSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  accountNumber: String,
  ifsc: String,
  balance: { type: Number, default: 0 }
});

// 12. Bank Transactions
const BankTransactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  bankAccountId: String,
  amount: Number,
  type: { type: String, enum: ['IN', 'OUT'] },
  // Category helps aggregate transactions reliably (OPENING, UPI, SUPPLIER, EXPENSE, OTHER)
  category: { type: String, enum: ['OPENING', 'UPI', 'SUPPLIER', 'EXPENSE', 'OTHER'], default: 'OTHER' },
  date: String,
  description: String,
  createdBy: String
});

// 13. Audit Log
const AuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: String,
  action: String,
  resource: String,
  resourceId: String,
  changes: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' },
  errorMessage: String
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Product: mongoose.model('Product', ProductSchema),
  Stock: mongoose.model('Stock', StockSchema),
  Sale: mongoose.model('Sale', SaleSchema),
  Expense: mongoose.model('Expense', ExpenseSchema),
  Customer: mongoose.model('Customer', CustomerSchema),
  CustomerPayment: mongoose.model('CustomerPayment', CustomerPaymentSchema),
  Supplier: mongoose.model('Supplier', SupplierSchema),
  SupplierPayment: mongoose.model('SupplierPayment', SupplierPaymentSchema),
  CashAdjustment: mongoose.model('CashAdjustment', CashAdjustmentSchema),
  BankAccount: mongoose.model('BankAccount', BankAccountSchema),
  BankTransaction: mongoose.model('BankTransaction', BankTransactionSchema),
  AuditLog: mongoose.model('AuditLog', AuditLogSchema),
};
