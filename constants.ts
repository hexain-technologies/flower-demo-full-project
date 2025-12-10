
import { Product, StockBatch, Sale, Expense, Supplier } from './types';

export const FLOWER_CATEGORIES = ['Roses', 'Lilies', 'Tulips', 'Orchids', 'Sunflowers', 'Fillers'];

export const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Red Rose', defaultPrice: 20, category: 'Roses' },
  { id: 'p2', name: 'White Lily', defaultPrice: 35, category: 'Lilies' },
  { id: 'p3', name: 'Pink Tulip', defaultPrice: 40, category: 'Tulips' },
  { id: 'p4', name: 'Blue Orchid', defaultPrice: 60, category: 'Orchids' },
  { id: 'p5', name: 'Sunflower', defaultPrice: 25, category: 'Sunflowers' },
  { id: 'p6', name: 'Baby Breath', defaultPrice: 15, category: 'Fillers' },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 'sup1', name: 'Global Flora Imports', contact: '555-0101', outstandingBalance: 500 },
  { id: 'sup2', name: 'City Garden Wholesalers', contact: '555-0202', outstandingBalance: 0 },
];

// Helper to get date string
const getDateStr = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

export const INITIAL_STOCK: StockBatch[] = [
  { id: 'b1', productId: 'p1', productName: 'Red Rose', quantity: 50, purchasePrice: 10, sellingPrice: 20, purchaseDate: getDateStr(0), originalQuantity: 50, supplierId: 'sup1', supplierName: 'Global Flora Imports', paymentStatus: 'CREDIT' },
  { id: 'b2', productId: 'p2', productName: 'White Lily', quantity: 20, purchasePrice: 20, sellingPrice: 35, purchaseDate: getDateStr(0), originalQuantity: 20, supplierId: 'sup2', supplierName: 'City Garden Wholesalers', paymentStatus: 'PAID' },
  { id: 'b3', productId: 'p1', productName: 'Red Rose', quantity: 15, purchasePrice: 10, sellingPrice: 15, purchaseDate: getDateStr(1), originalQuantity: 30, supplierId: 'sup1', supplierName: 'Global Flora Imports', paymentStatus: 'PAID' }, // Old stock
  { id: 'b4', productId: 'p3', productName: 'Pink Tulip', quantity: 10, purchasePrice: 25, sellingPrice: 40, purchaseDate: getDateStr(2), originalQuantity: 20, supplierId: 'sup1', supplierName: 'Global Flora Imports', paymentStatus: 'PAID' }, // Damaged (automatically calculated in logic)
];

export const INITIAL_SALES: Sale[] = [
  {
    id: 's1',
    date: new Date().toISOString(),
    subTotal: 100,
    discount: 0,
    totalAmount: 100,
    amountPaid: 100,
    changeReturned: 0,
    paymentMode: 'CASH',
    customerName: 'Walk-in',
    createdBy: 'John Doe',
    items: [{ stockBatchId: 'b1', productId: 'p1', productName: 'Red Rose', quantity: 5, price: 20, status: 'NEW' }]
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  { id: 'e1', category: 'SHOP_EXPENSE', amount: 50, description: 'Tea & Snacks', date: getDateStr(0), createdBy: 'Jane Smith' }
];