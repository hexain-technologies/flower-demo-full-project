import { v4 as uuidv4 } from 'uuid';
import { Product, StockBatch, Sale, Expense, Customer, StockStatus, UserRole, Supplier, SupplierPayment, User, CustomerPayment, CashAdjustment, BankAccount, BankTransaction } from '../types';

/**
 * ============================================================================
 * REAL API CLIENT (Connects to Node.js/SQLite Backend)
 * ============================================================================
 */

const API_URL = '/api';

class ApiClient {
  private users: User[] = [];
  private products: Product[] = [];
  private stock: StockBatch[] = [];
  private sales: Sale[] = [];
  private expenses: Expense[] = [];
  private customers: Customer[] = [];
  private customerPayments: CustomerPayment[] = [];
  private suppliers: Supplier[] = [];
  private supplierPayments: SupplierPayment[] = [];
  private cashAdjustments: CashAdjustment[] = [];
  private bankAccounts: BankAccount[] = [];
  private bankTransactions: BankTransaction[] = [];
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('flora_accessToken');
    this.refreshToken = localStorage.getItem('flora_refreshToken');
  }

  private getHeaders() {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  private async handleResponse(res: Response) {
    if (res.status === 401) {
      // Token expired, try to refresh
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        this.logout();
      }
    }
    return res;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });
      if (!res.ok) return false;
      const { accessToken } = await res.json();
      this.accessToken = accessToken;
      localStorage.setItem('flora_accessToken', accessToken);
      return true;
    } catch (e) {
      console.error('Token refresh failed', e);
      return false;
    }
  }

  private logout() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('flora_accessToken');
    localStorage.removeItem('flora_refreshToken');
    localStorage.removeItem('flora_userRole');
    localStorage.removeItem('flora_userName');
  }

  // Used for synchronous state initialization in Context, 
  // but actual data is fetched async. 
  // The Context logic expects immediate return for initial state,
  // so we return empty arrays initially and let refreshData() populate them.

  // --- ASYNC FETCHERS ---
  async fetchAll() {
      try {
        const headers = this.getHeaders();
        const [users, prods, stock, sales, exp, cust, cp, supp, sp, adj, banks, btx] = await Promise.all([
            fetch(`${API_URL}/users`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/products`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/stock`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/sales`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/expenses`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/customers`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/customer-payments`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/suppliers`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/supplier-payments`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/cash-adjustments`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/bank-accounts`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
            fetch(`${API_URL}/bank-transactions`, { headers }).then(r => this.handleResponse(r)).then(r => r.json()),
        ]);
        
        this.users = users;
        this.products = prods;
        this.stock = stock;
        this.sales = sales;
        this.expenses = exp;
        this.customers = cust;
        this.customerPayments = cp;
        this.suppliers = supp;
        this.supplierPayments = sp;
        this.cashAdjustments = adj;
        this.bankAccounts = banks;
        this.bankTransactions = btx;

        return true;
      } catch (e) {
          console.error("API Fetch Error:", e);
          return false;
      }
  }

  // --- Sync Getters (Return last fetched data) ---
  getUsers() { return this.users; }
  getProducts() { return this.products; }
  getStock() { return this.stock; }
  getSales() { return this.sales; }
  getExpenses() { return this.expenses; }
  getCustomers() { return this.customers; }
  getCustomerPayments() { return this.customerPayments; }
  getSuppliers() { return this.suppliers; }
  getSupplierPayments() { return this.supplierPayments; }
  getCashAdjustments() { return this.cashAdjustments; }
  getBankAccounts() { return this.bankAccounts; }
  getBankTransactions() { return this.bankTransactions; }


  // --- Auth ---
  async authenticate(username: string, password: string): Promise<User | null> {
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) return null;
        const data = await res.json();
        
        this.accessToken = data.accessToken;
        this.refreshToken = data.refreshToken;
        
        localStorage.setItem('flora_accessToken', data.accessToken);
        localStorage.setItem('flora_refreshToken', data.refreshToken);
        
        return {
          id: data.id,
          username: data.username,
          name: data.name,
          role: data.role as UserRole,
          password: '' // don't expose password to frontend
        };
    } catch(e) {
        console.error(e);
        return null;
    }
  }

  async logoutUser(): Promise<void> {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      this.logout();
    }
  }

  // --- ACTIONS ---

  async createUser(user: User) {
     await fetch(`${API_URL}/users`, {
         method: 'POST', headers: this.getHeaders(),
         body: JSON.stringify(user)
     });
  }

  async updateUser(user: User) {
    await fetch(`${API_URL}/users/${user.id}`, {
        method: 'PUT', headers: this.getHeaders(),
        body: JSON.stringify(user)
    });
  }

  async deleteUser(userId: string) {
    await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE', headers: this.getHeaders()
    });
  }

  async createCustomer(customer: Customer) {
    await fetch(`${API_URL}/customers`, {
        method: 'POST', headers: this.getHeaders(),
        body: JSON.stringify(customer)
    });
  }

  async createSale(newSale: Sale) {
    await fetch(`${API_URL}/sales`, {
        method: 'POST', headers: this.getHeaders(),
        body: JSON.stringify(newSale)
    });
  }

  async createPurchase(batch: StockBatch) {
    await fetch(`${API_URL}/stock`, {
        method: 'POST', headers: this.getHeaders(),
        body: JSON.stringify(batch)
    });
  }

  async addSupplier(supplier: Supplier) {
    await fetch(`${API_URL}/suppliers`, {
        method: 'POST', headers: this.getHeaders(),
        body: JSON.stringify(supplier)
    });
  }

  async addSupplierPayment(payment: SupplierPayment) {
    await fetch(`${API_URL}/supplier-payments`, {
        method: 'POST', headers: this.getHeaders(),
        body: JSON.stringify(payment)
    });
  }

  async createExpense(expense: Expense) {
    await fetch(`${API_URL}/expenses`, {
        method: 'POST', headers: this.getHeaders(),
        body: JSON.stringify(expense)
    });
  }

  async deleteSale(saleId: string, role: UserRole | null) {
    await fetch(`${API_URL}/sales/${saleId}`, { 
      method: 'DELETE',
      headers: this.getHeaders()
    });
  }

  async addCustomerPayment(customerId: string, amount: number, createdBy: string, paymentMethod?: string, bankAccountId?: string) {
    const payment: any = {
        id: uuidv4(),
        customerId, amount, date: new Date().toISOString(), createdBy
    };
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (bankAccountId) payment.bankAccountId = bankAccountId;
    await fetch(`${API_URL}/customer-payments`, {
        method: 'POST', headers: this.getHeaders(),
        body: JSON.stringify(payment)
    });
  }

  async addCashAdjustment(adj: CashAdjustment) {
    await fetch(`${API_URL}/cash-adjustments`, {
        method: 'POST', headers: this.getHeaders(),
        body: JSON.stringify(adj)
    });
  }

  async createBankAccount(account: BankAccount) {
    await fetch(`${API_URL}/bank-accounts`, {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify(account)
    });
  }

  async updateBankAccount(account: BankAccount) {
    await fetch(`${API_URL}/bank-accounts/${account.id}`, {
      method: 'PUT', headers: this.getHeaders(),
      body: JSON.stringify(account)
    });
  }

  async createBankTransaction(tx: BankTransaction) {
    await fetch(`${API_URL}/bank-transactions`, {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify(tx)
    });
  }

  async createProduct(product: { name: string; defaultPrice: number; category: string }): Promise<Product | null> {
    try {
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(product)
      });
      if (!res.ok) return null;
      const created: Product = await res.json();
      this.products = [...this.products, created];
      return created;
    } catch (e) {
      console.error('createProduct error', e);
      return null;
    }
  }

  async getBankSummary() {
    try {
      const res = await fetch(`${API_URL}/bank-summary`, {
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch bank summary');
      return await res.json();
    } catch (e) {
      console.error('getBankSummary error', e);
      return null;
    }
  }

  // --- HELPERS (Logic remains on frontend for display) ---
  getStockStatusForBatch(batch: StockBatch): StockStatus {
    const today = new Date().toISOString().split('T')[0];
    const batchDate = new Date(batch.purchaseDate).toISOString().split('T')[0];
    const diffTime = Math.abs(new Date(today).getTime() - new Date(batchDate).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays === 0) return 'NEW';
    if (diffDays === 1) return 'OLD';
    return 'DAMAGED';
  }

  getComputedStock() {
    const newStock: StockBatch[] = [];
    const oldStock: StockBatch[] = [];
    const damagedStock: StockBatch[] = [];

    this.stock.forEach(batch => {
      const status = this.getStockStatusForBatch(batch);
      if (batch.quantity > 0 || status === 'DAMAGED') { 
         if (status === 'NEW') newStock.push(batch);
         else if (status === 'OLD') oldStock.push(batch);
         else damagedStock.push(batch);
      }
    });
    return { newStock, oldStock, damagedStock };
  }
}

export const api = new ApiClient();
