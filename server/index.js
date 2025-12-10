require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./database');
const { v4: uuidv4 } = require('uuid');

const { 
  hashPassword, 
  comparePassword, 
  generateTokens, 
  verifyRefreshToken, 
  getClientIp, 
  logAudit, 
  authMiddleware, 
  requireAdmin 
} = require('./auth');

const {
  loginLimiter,
  apiLimiter,
  sanitizeInput,
  sanitizeData,
  securityHeaders,
  safeErrorHandler
} = require('./security');

const { 
  User, Product, Stock, Sale, Expense, 
  Customer, CustomerPayment, Supplier, 
  SupplierPayment, CashAdjustment, BankAccount, BankTransaction, AuditLog
} = require('./models');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(securityHeaders);
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb' }));
app.use(sanitizeData);
app.use(apiLimiter);

// Connect Database
connectDB().catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
});

// --- API ROUTES ---

app.post('/api/login', loginLimiter, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const { username, password } = sanitizeInput(req.body);
        
        if (!username || !password) {
            await logAudit(null, 'LOGIN_ATTEMPT', 'USER', null, null, 'FAILURE', 'Missing credentials', ip);
            return res.status(400).json({ error: "Username and password required" });
        }

        const user = await User.findOne({ username });
        
        if (!user || !user.isActive) {
            await logAudit(null, 'LOGIN_ATTEMPT', 'USER', username, null, 'FAILURE', 'User not found or inactive', ip);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const passwordMatch = await comparePassword(password, user.password);
        if (!passwordMatch) {
            await logAudit(user.id, 'LOGIN_ATTEMPT', 'USER', user.id, null, 'FAILURE', 'Invalid password', ip);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const { accessToken, refreshToken } = generateTokens(user);
        
        await User.findOneAndUpdate({ id: user.id }, { lastLogin: new Date() });
        await logAudit(user.id, 'LOGIN', 'USER', user.id, null, 'SUCCESS', null, ip);

        res.json({ 
            id: user.id, 
            username: user.username, 
            name: user.name, 
            role: user.role,
            accessToken,
            refreshToken
        });
    } catch (e) { 
        await logAudit(null, 'LOGIN_ATTEMPT', 'USER', null, null, 'FAILURE', 'Login failed', ip);
        const error = safeErrorHandler(e, 500, 'Login failed');
        res.status(500).json(error);
    }
});

app.post('/api/refresh-token', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) return res.status(401).json({ error: "Invalid refresh token" });

        const user = await User.findOne({ id: decoded.id, isActive: true });
        if (!user) return res.status(401).json({ error: "User not found" });

        const tokens = generateTokens(user);
        res.json(tokens);
    } catch (e) {
        const error = safeErrorHandler(e, 500, 'Token refresh failed');
        res.status(500).json(error);
    }
});

// Logout Endpoint
app.post('/api/logout', authMiddleware, async (req, res) => {
    try {
        const ip = getClientIp(req);
        await logAudit(req.user.id, 'LOGOUT', 'USER', req.user.id, null, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Users
app.get('/api/users', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/users', authMiddleware, requireAdmin, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const { name, username, password, role } = req.body;
        
        if (!name || !username || !password) {
            return res.status(400).json({ error: "Name, username, and password are required" });
        }

        if (!/^[a-zA-Z0-9_-]{3,}$/.test(username)) {
            return res.status(400).json({ error: "Username must be 3+ chars (alphanumeric, -, _)" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const hashedPassword = await hashPassword(password);
        const newUser = await User.create({
            id: uuidv4(),
            name,
            username,
            password: hashedPassword,
            role: role || 'SALES_STAFF',
            isActive: true
        });

        await logAudit(req.user.id, 'CREATE_USER', 'USER', newUser.id, { name, username, role }, 'SUCCESS', null, ip);
        res.json({ success: true, userId: newUser.id });
    } catch (e) { 
        await logAudit(req.user.id, 'CREATE_USER', 'USER', null, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

app.put('/api/users/:id', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const userId = req.params.id;
        
        if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
            return res.status(403).json({ error: "Can only update own profile or admin users" });
        }

        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { name, password, role } = req.body;
        const updates = { updatedAt: new Date() };

        if (name) updates.name = name;
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ error: "Password must be at least 6 characters" });
            }
            updates.password = await hashPassword(password);
        }

        if (role && req.user.role === 'ADMIN') {
            updates.role = role;
        }

        await User.findOneAndUpdate({ id: userId }, updates);
        await logAudit(req.user.id, 'UPDATE_USER', 'USER', userId, updates, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) { 
        await logAudit(req.user.id, 'UPDATE_USER', 'USER', req.params.id, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

// Deactivate User
app.delete('/api/users/:id', authMiddleware, requireAdmin, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const userId = req.params.id;
        
        if (userId === req.user.id) {
            return res.status(400).json({ error: "Cannot deactivate your own account" });
        }

        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await User.findOneAndUpdate({ id: userId }, { isActive: false });
        await logAudit(req.user.id, 'DEACTIVATE_USER', 'USER', userId, { isActive: false }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) { 
        await logAudit(req.user.id, 'DEACTIVATE_USER', 'USER', req.params.id, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

app.get('/api/products', authMiddleware, async (req, res) => {
    try {
        res.json(await Product.find());
    } catch (e) {
        const error = safeErrorHandler(e);
        res.status(500).json(error);
    }
});

app.post('/api/products', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { name, defaultPrice, category } = sanitizeInput(req.body);
        const ip = getClientIp(req);
        const newId = uuidv4();
        const created = await Product.create({ id: newId, name, defaultPrice, category });
        await logAudit(req.user.id, 'CREATE_PRODUCT', 'PRODUCT', newId, { name, defaultPrice, category }, 'SUCCESS', null, ip);
        res.json(created);
    } catch (e) {
        await logAudit(req.user.id, 'CREATE_PRODUCT', 'PRODUCT', null, null, 'FAILURE', e.message, getClientIp(req));
        const error = safeErrorHandler(e);
        res.status(500).json(error);
    }
});

app.get('/api/stock', authMiddleware, async (req, res) => {
    try {
        res.json(await Stock.find());
    } catch (e) {
        const error = safeErrorHandler(e);
        res.status(500).json(error);
    }
});

app.post('/api/stock', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const b = req.body;
        await Stock.create(b);
        
        // Update Supplier Balance if Credit
        if (b.paymentStatus === 'CREDIT' && b.supplierId) {
            const totalCost = b.originalQuantity * b.purchasePrice;
            await Supplier.findOneAndUpdate(
                { id: b.supplierId }, 
                { $inc: { outstandingBalance: totalCost } }
            );
        }
        await logAudit(req.user.id, 'CREATE_STOCK', 'STOCK', b.id, { quantity: b.originalQuantity, purchasePrice: b.purchasePrice }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) { 
        await logAudit(req.user.id, 'CREATE_STOCK', 'STOCK', null, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

// Update Stock Price
app.put('/api/stock/:id', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const { sellingPrice } = req.body;
        await Stock.findOneAndUpdate({ id: req.params.id }, { sellingPrice });
        await logAudit(req.user.id, 'UPDATE_STOCK', 'STOCK', req.params.id, { sellingPrice }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) { 
        await logAudit(req.user.id, 'UPDATE_STOCK', 'STOCK', req.params.id, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

// 5. Sales (The Complex One)
app.get('/api/sales', authMiddleware, async (req, res) => {
    try {
        const sales = await Sale.find().sort({ date: -1 });
        res.json(sales);
    } catch (e) {
        const error = safeErrorHandler(e);
        res.status(500).json(error);
    }
});

app.post('/api/sales', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const s = req.body;
        
        if (!s.items || !Array.isArray(s.items) || s.items.length === 0) {
            return res.status(400).json({ error: "Sale must have at least one item" });
        }
        
        if (s.totalAmount === undefined || isNaN(s.totalAmount) || s.totalAmount < 0) {
            return res.status(400).json({ error: "Invalid total amount" });
        }
        
        if (s.amountPaid === undefined || isNaN(s.amountPaid) || s.amountPaid < 0) {
            return res.status(400).json({ error: "Amount paid cannot be negative" });
        }
        
        if (s.discount !== undefined && (isNaN(s.discount) || s.discount < 0)) {
            return res.status(400).json({ error: "Discount cannot be negative" });
        }
        
        // 1. Create Sale with UUID
        const saleId = uuidv4();
        const saleData = {
            ...s,
            id: saleId,
            createdBy: req.user.id
        };
        await Sale.create(saleData);

        // 2. Update Stock Quantities
        for (const item of s.items) {
            await Stock.findOneAndUpdate(
                { id: item.stockBatchId },
                { $inc: { quantity: -item.quantity } }
            );
        }

        // 3. Handle Credit (Customer Balance)
        if (s.paymentMode === 'CREDIT') {
            const debt = s.totalAmount - s.amountPaid;
            if (debt > 0) {
                if (s.customerId) {
                    await Customer.findOneAndUpdate(
                        { id: s.customerId }, 
                        { $inc: { outstandingBalance: debt } }
                    );
                        } else if (s.customerName) {
                            // Previously we auto-created customers by name here. That caused
                            // unexpected entries in the DB. To avoid automatic creation,
                            // we now skip creating customers when only a name is provided.
                            // If you want to add customers, use the explicit `/api/customers` endpoint.
                            console.log('Sale with customerName provided but no customerId — skipping auto-create for:', s.customerName);
                        }
            }
        }
        // 4. If payment was via UPI and amountPaid > 0, record bank transaction (move to bank)
        if (s.paymentMode === 'UPI' && s.amountPaid > 0) {
            try {
                // Use provided bankAccountId if present, otherwise pick the first bank account.
                // If no bank account exists, create an Auto-UPI bank account so UPI receipts are tracked.
                let bank = null;
                if (s.bankAccountId) {
                    bank = await BankAccount.findOne({ id: s.bankAccountId });
                }
                if (!bank) bank = await BankAccount.findOne();
                if (!bank) {
                    const autoId = uuidv4();
                    bank = await BankAccount.create({ id: autoId, name: 'Auto UPI Account', accountNumber: 'AUTO', ifsc: 'AUTO', balance: 0 });
                    console.log(`Auto-created bank account for UPI receipts: ${bank.id} (${bank.name})`);
                }

                const txnId = uuidv4();
                const createdTxn = await BankTransaction.create({
                    id: txnId,
                    bankAccountId: bank.id,
                    amount: s.amountPaid,
                    type: 'IN',
                    category: 'UPI',
                    date: new Date().toISOString(),
                    description: `UPI Sale ${s.id}`,
                    createdBy: s.createdBy
                });
                console.log(`Created BankTransaction ${createdTxn.id} IN ₹${createdTxn.amount} -> account ${createdTxn.bankAccountId} (UPI sale ${s.id})`);
                await BankAccount.findOneAndUpdate({ id: bank.id }, { $inc: { balance: s.amountPaid } });
            } catch (e) {
                console.error('bank txn on sale error', e);
            }
        }
        await logAudit(req.user.id, 'CREATE_SALE', 'SALE', s.id, { totalAmount: s.totalAmount, items: s.items.length }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) { 
        await logAudit(req.user.id, 'CREATE_SALE', 'SALE', null, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

app.delete('/api/sales/:id', authMiddleware, requireAdmin, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const id = req.params.id;
        const sale = await Sale.findOne({ id });
        if (!sale) return res.status(404).json({ error: "Not found" });

        // 1. Revert Stock
        for (const item of sale.items) {
            await Stock.findOneAndUpdate(
                { id: item.stockBatchId },
                { $inc: { quantity: item.quantity } }
            );
        }

        // 2. Revert Customer Balance
        if (sale.paymentMode === 'CREDIT' && sale.customerId) {
            const debt = sale.totalAmount - sale.amountPaid;
            await Customer.findOneAndUpdate(
                { id: sale.customerId },
                { $inc: { outstandingBalance: -debt } }
            );
        }

        // 3. Delete Sale
        await Sale.deleteOne({ id });
        await logAudit(req.user.id, 'DELETE_SALE', 'SALE', id, { totalAmount: sale.totalAmount }, 'SUCCESS', null, ip);
        res.json({ success: true });

    } catch (e) { 
        await logAudit(req.user.id, 'DELETE_SALE', 'SALE', req.params.id, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

// 6. Expenses
app.get('/api/expenses', authMiddleware, async (req, res) => {
    try {
        res.json(await Expense.find().sort({ date: -1 }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/expenses', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const e = req.body;
        
        if (!e.category || !e.category.trim()) {
            return res.status(400).json({ error: "Expense category is required" });
        }
        
        if (!e.amount || isNaN(e.amount) || e.amount <= 0) {
            return res.status(400).json({ error: "Expense amount must be greater than 0" });
        }
        
        const expenseId = uuidv4();
        const expenseData = {
            ...e,
            id: expenseId,
            createdBy: req.user.id
        };
        await Expense.create(expenseData);

        // If expense paid via bank, record bank transaction and update account
        if (e.paymentMode === 'BANK' || e.bankAccountId) {
            const bankId = e.bankAccountId;
            if (bankId) {
                const txnId = uuidv4();
                const createdTxn = await BankTransaction.create({
                    id: txnId,
                    bankAccountId: bankId,
                    amount: e.amount,
                    type: 'OUT',
                    category: 'EXPENSE',
                    date: e.date || new Date().toISOString(),
                    description: e.description || 'Expense',
                    createdBy: e.createdBy || 'system'
                });
                console.log(`Created BankTransaction ${createdTxn.id} OUT ₹${createdTxn.amount} -> account ${createdTxn.bankAccountId} (Expense)`);
                await BankAccount.findOneAndUpdate({ id: bankId }, { $inc: { balance: -e.amount } });
            }
        }

        await logAudit(req.user.id, 'CREATE_EXPENSE', 'EXPENSE', e.id, { amount: e.amount, category: e.category }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (err) { 
        await logAudit(req.user.id, 'CREATE_EXPENSE', 'EXPENSE', null, null, 'FAILURE', err.message, ip);
        res.status(500).json({ error: err.message }); 
    }
});

// 7. Customers
app.get('/api/customers', authMiddleware, async (req, res) => {
    try {
        res.json(await Customer.find());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const { name, phone, outstandingBalance } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Customer name is required" });
        }
        
        if (outstandingBalance !== undefined && (outstandingBalance < 0 || isNaN(outstandingBalance))) {
            return res.status(400).json({ error: "Outstanding balance must be non-negative" });
        }
        
        await Customer.create({ 
            id: uuidv4(),
            name: name.trim(), 
            phone: phone || '',
            outstandingBalance: outstandingBalance || 0
        });
        
        await logAudit(req.user.id, 'CREATE_CUSTOMER', 'CUSTOMER', null, { name }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) {
        await logAudit(req.user.id, 'CREATE_CUSTOMER', 'CUSTOMER', null, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message });
    }
});

// 8. Customer Payments
app.get('/api/customer-payments', authMiddleware, async (req, res) => {
    try {
        res.json(await CustomerPayment.find().sort({ date: -1 }));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/customer-payments', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    const p = req.body;
    try {
        if (!p.customerId) {
            return res.status(400).json({ error: "Customer ID is required" });
        }
        
        if (!p.amount || isNaN(p.amount) || p.amount <= 0) {
            return res.status(400).json({ error: "Payment amount must be greater than 0" });
        }
        
        const customer = await Customer.findOne({ id: p.customerId });
        if (!customer) {
            return res.status(404).json({ error: "Customer not found" });
        }
        
        const paymentId = uuidv4();
        await CustomerPayment.create({
            id: paymentId,
            customerId: p.customerId,
            amount: p.amount,
            paymentMethod: p.paymentMethod || 'CASH',
            bankAccountId: p.bankAccountId || null,
            date: p.date || new Date().toISOString(),
            createdBy: req.user.id
        });
        
        // Decrease debt
        await Customer.findOneAndUpdate(
            { id: p.customerId },
            { $inc: { outstandingBalance: -p.amount } }
        );

        // If payment received via bank/UPI, create a BankTransaction IN and update account balance
        if (p.paymentMethod === 'UPI' || p.paymentMethod === 'BANK' || p.bankAccountId) {
            const bankId = p.bankAccountId || (await BankAccount.findOne())?.id;
            if (bankId) {
                const txnId = uuidv4();
                const createdTxn = await BankTransaction.create({
                    id: txnId,
                    bankAccountId: bankId,
                    amount: p.amount,
                    type: 'IN',
                    category: p.paymentMethod === 'UPI' ? 'UPI' : 'OTHER',
                    date: p.date || new Date().toISOString(),
                    description: `Customer Payment (${p.customerId})`,
                    createdBy: req.user.id
                });
                console.log(`Created BankTransaction ${createdTxn.id} IN ₹${createdTxn.amount} -> account ${createdTxn.bankAccountId} (Customer Payment)`);
                await BankAccount.findOneAndUpdate({ id: bankId }, { $inc: { balance: p.amount } });
            }
        }

        await logAudit(req.user.id, 'CREATE_CUSTOMER_PAYMENT', 'PAYMENT', paymentId, { customerId: p.customerId, amount: p.amount }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (err) { 
        await logAudit(req.user.id, 'CREATE_CUSTOMER_PAYMENT', 'PAYMENT', null, null, 'FAILURE', err.message, ip);
        res.status(500).json({ error: err.message }); 
    }
});

// 9. Suppliers
app.get('/api/suppliers', authMiddleware, async (req, res) => {
    try {
        res.json(await Supplier.find());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/suppliers', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const { name, phone, outstandingBalance } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Supplier name is required" });
        }
        
        if (outstandingBalance !== undefined && (outstandingBalance < 0 || isNaN(outstandingBalance))) {
            return res.status(400).json({ error: "Outstanding balance must be non-negative" });
        }
        
        await Supplier.create({
            id: uuidv4(),
            name: name.trim(),
            phone: phone || '',
            outstandingBalance: outstandingBalance || 0
        });
        
        await logAudit(req.user.id, 'CREATE_SUPPLIER', 'SUPPLIER', null, { name }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) {
        await logAudit(req.user.id, 'CREATE_SUPPLIER', 'SUPPLIER', null, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message });
    }
});

// 10. Supplier Payments
app.get('/api/supplier-payments', authMiddleware, async (req, res) => {
    try {
        res.json(await SupplierPayment.find().sort({ date: -1 }));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/supplier-payments', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    const p = req.body;
    try {
        if (!p.supplierId) {
            return res.status(400).json({ error: "Supplier ID is required" });
        }
        
        if (!p.amount || isNaN(p.amount) || p.amount <= 0) {
            return res.status(400).json({ error: "Payment amount must be greater than 0" });
        }
        
        const supplier = await Supplier.findOne({ id: p.supplierId });
        if (!supplier) {
            return res.status(404).json({ error: "Supplier not found" });
        }
        
        const paymentId = uuidv4();
        await SupplierPayment.create({
            id: paymentId,
            supplierId: p.supplierId,
            amount: p.amount,
            paymentMode: p.paymentMode || 'CASH',
            bankAccountId: p.bankAccountId || null,
            note: p.note || '',
            date: p.date || new Date().toISOString(),
            createdBy: req.user.id
        });
        
        // Decrease debt
        await Supplier.findOneAndUpdate(
            { id: p.supplierId },
            { $inc: { outstandingBalance: -p.amount } }
        );
        
        // If payment was made via bank or UPI, create bank txn and update bank account
        if (p.paymentMode === 'BANK' || p.paymentMode === 'UPI' || p.bankAccountId) {
            let bankId = p.bankAccountId;
            if (!bankId) {
                const firstBank = await BankAccount.findOne();
                bankId = firstBank ? firstBank.id : null;
            }
            if (bankId) {
                const txnId = uuidv4();
                const createdTxn = await BankTransaction.create({
                    id: txnId,
                    bankAccountId: bankId,
                    amount: p.amount,
                    type: 'OUT',
                    category: 'SUPPLIER',
                    date: p.date || new Date().toISOString(),
                    description: p.note || 'Supplier Payment',
                    createdBy: req.user.id
                });
                console.log(`Created BankTransaction ${createdTxn.id} OUT ₹${createdTxn.amount} -> account ${createdTxn.bankAccountId} (Supplier Payment)`);
                await BankAccount.findOneAndUpdate({ id: bankId }, { $inc: { balance: -p.amount } });
            }
        }
        
        await logAudit(req.user.id, 'CREATE_SUPPLIER_PAYMENT', 'PAYMENT', paymentId, { supplierId: p.supplierId, amount: p.amount }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (err) { 
        await logAudit(req.user.id, 'CREATE_SUPPLIER_PAYMENT', 'PAYMENT', null, null, 'FAILURE', err.message, ip);
        res.status(500).json({ error: err.message }); 
    }
});

// Bank summary endpoint — aggregates bank transactions and balances
app.get('/api/bank-summary', authMiddleware, async (req, res) => {
    try {
        const accounts = await BankAccount.find();
        const txs = await BankTransaction.find().sort({ date: 1 });
        const cashAdjustments = await CashAdjustment.find();

        // Helper to sum amounts by predicate
        const sumBy = (arr, predicate) => arr.filter(predicate).reduce((s, t) => s + (t.amount || 0), 0);

        // Global aggregates using explicit category where possible
        const openingIn = sumBy(txs, t => (t.category === 'OPENING'));
        const upiIn = sumBy(txs, t => (t.category === 'UPI'));
        const totalIn = sumBy(txs, t => t.type === 'IN');
        const totalOut = sumBy(txs, t => t.type === 'OUT');
        const supplierOut = sumBy(txs, t => t.category === 'SUPPLIER');
        const expensesOut = sumBy(txs, t => t.category === 'EXPENSE');

                const computedBalance = totalIn - totalOut;

                // Include opening balances entered in Day Book (CashAdjustments)
                // Day Book opening entries are recorded as CashAdjustment with type 'ADD' and description containing 'opening'
                const openingFromDaybook = cashAdjustments
                    .filter(c => c.type === 'ADD' && /opening/i.test(c.description || ''))
                    .reduce((s, c) => s + (c.amount || 0), 0);

                // Adjust computed balance to include Day Book opening balances
                const computedBalanceWithOpening = computedBalance + openingFromDaybook;
        const accountBalances = accounts.reduce((s, a) => s + (a.balance || 0), 0);

        // Per-account breakdown
        const perAccount = accounts.map(acc => {
            const accTx = txs.filter(t => t.bankAccountId === acc.id);
            const accTotalIn = sumBy(accTx, t => t.type === 'IN');
            const accTotalOut = sumBy(accTx, t => t.type === 'OUT');
            const accOpening = sumBy(accTx, t => t.category === 'OPENING');
            const accUpi = sumBy(accTx, t => t.category === 'UPI');
            const accSupplierOut = sumBy(accTx, t => t.category === 'SUPPLIER');
            const accExpensesOut = sumBy(accTx, t => t.category === 'EXPENSE');
            const accComputed = accTotalIn - accTotalOut;
            return {
                bankAccountId: acc.id,
                name: acc.name,
                accountNumber: acc.accountNumber,
                accountBalance: acc.balance || 0,
                opening: accOpening,
                upiIn: accUpi,
                totalIn: accTotalIn,
                totalOut: accTotalOut,
                supplierOut: accSupplierOut,
                expensesOut: accExpensesOut,
                computedBalance: accComputed
            };
        });

        res.json({
            openingIn,
            upiIn,
            totalIn,
            totalOut,
            supplierOut,
            expensesOut,
            computedBalance,
            accountBalances,
            perAccount,
            openingFromDaybook,
            computedBalanceWithOpening
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 11. Cash Adjustments
app.get('/api/cash-adjustments', authMiddleware, async (req, res) => {
    try {
        res.json(await CashAdjustment.find().sort({ date: -1 }));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/cash-adjustments', authMiddleware, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const c = req.body;
        
        if (!c.type || !['ADD', 'REMOVE'].includes(c.type)) {
            return res.status(400).json({ error: "Type must be ADD or REMOVE" });
        }
        
        if (!c.amount || isNaN(c.amount) || c.amount <= 0) {
            return res.status(400).json({ error: "Amount must be greater than 0" });
        }
        
        const adjustmentId = uuidv4();
        await CashAdjustment.create({
            id: adjustmentId,
            type: c.type,
            amount: c.amount,
            description: c.description || '',
            date: c.date || new Date().toISOString(),
            createdBy: req.user.id
        });
        
        await logAudit(req.user.id, 'CREATE_CASH_ADJUSTMENT', 'ADJUSTMENT', adjustmentId, { type: c.type, amount: c.amount }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) {
        await logAudit(req.user.id, 'CREATE_CASH_ADJUSTMENT', 'ADJUSTMENT', null, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message });
    }
});

// Bank Accounts
app.get('/api/bank-accounts', authMiddleware, async (req, res) => {
    try {
        res.json(await BankAccount.find());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/bank-accounts', authMiddleware, requireAdmin, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const { name, accountNumber, ifsc, balance } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Account name is required" });
        }
        
        if (balance !== undefined && (isNaN(balance) || balance < 0)) {
            return res.status(400).json({ error: "Balance cannot be negative" });
        }
        
        const accountId = uuidv4();
        await BankAccount.create({
            id: accountId,
            name: name.trim(),
            accountNumber: accountNumber || '',
            ifsc: ifsc || '',
            balance: balance || 0
        });
        
        await logAudit(req.user.id, 'CREATE_BANK_ACCOUNT', 'BANK_ACCOUNT', accountId, { name }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) { 
        await logAudit(req.user.id, 'CREATE_BANK_ACCOUNT', 'BANK_ACCOUNT', null, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

// Update bank account
app.put('/api/bank-accounts/:id', authMiddleware, requireAdmin, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const id = req.params.id;
        const payload = req.body;
        
        if (payload.name && !payload.name.trim()) {
            return res.status(400).json({ error: "Account name cannot be empty" });
        }
        
        if (payload.balance !== undefined && (isNaN(payload.balance) || payload.balance < 0)) {
            return res.status(400).json({ error: "Balance cannot be negative" });
        }
        
        const update = {
            ...(payload.name ? { name: payload.name.trim() } : {}),
            ...(payload.accountNumber !== undefined ? { accountNumber: payload.accountNumber } : {}),
            ...(payload.ifsc !== undefined ? { ifsc: payload.ifsc } : {}),
            ...(payload.balance !== undefined ? { balance: payload.balance } : {})
        };
        
        await BankAccount.findOneAndUpdate({ id }, update, { new: true });
        await logAudit(req.user.id, 'UPDATE_BANK_ACCOUNT', 'BANK_ACCOUNT', id, update, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) { 
        await logAudit(req.user.id, 'UPDATE_BANK_ACCOUNT', 'BANK_ACCOUNT', req.params.id, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

// Bank Transactions
app.get('/api/bank-transactions', authMiddleware, async (req, res) => {
    try {
        res.json(await BankTransaction.find().sort({ date: -1 }));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/bank-transactions', authMiddleware, requireAdmin, async (req, res) => {
    const ip = getClientIp(req);
    try {
        const t = req.body;
        
        if (!t.bankAccountId) {
            return res.status(400).json({ error: "Bank account ID is required" });
        }
        
        if (!t.type || !['IN', 'OUT'].includes(t.type)) {
            return res.status(400).json({ error: "Type must be IN or OUT" });
        }
        
        if (!t.amount || isNaN(t.amount) || t.amount <= 0) {
            return res.status(400).json({ error: "Amount must be greater than 0" });
        }
        
        const bankAccount = await BankAccount.findOne({ id: t.bankAccountId });
        if (!bankAccount) {
            return res.status(404).json({ error: "Bank account not found" });
        }
        
        const payload = {
            id: uuidv4(),
            bankAccountId: t.bankAccountId,
            amount: t.amount,
            type: t.type,
            category: t.category || 'OTHER',
            date: t.date || new Date().toISOString(),
            description: t.description || '',
            createdBy: req.user.id
        };
        
        // Ensure category exists for reliable aggregation
        if (!payload.category) {
            const desc = (payload.description || '').toLowerCase();
            if (desc.includes('opening')) payload.category = 'OPENING';
            else if (desc.includes('upi')) payload.category = 'UPI';
            else if (desc.includes('supplier')) payload.category = 'SUPPLIER';
            else if (payload.type === 'OUT') payload.category = 'EXPENSE';
            else payload.category = 'OTHER';
        }
        
        const createdTxn = await BankTransaction.create(payload);
        console.log(`Created BankTransaction ${createdTxn.id} ${createdTxn.type} ₹${createdTxn.amount} -> account ${createdTxn.bankAccountId} (category: ${createdTxn.category})`);
        
        // Update bank account balance
        if (t.type === 'IN') {
            await BankAccount.findOneAndUpdate({ id: t.bankAccountId }, { $inc: { balance: t.amount } });
        } else {
            await BankAccount.findOneAndUpdate({ id: t.bankAccountId }, { $inc: { balance: -t.amount } });
        }
        
        await logAudit(req.user.id, 'CREATE_BANK_TRANSACTION', 'TRANSACTION', createdTxn.id, { amount: t.amount, type: t.type }, 'SUCCESS', null, ip);
        res.json({ success: true });
    } catch (e) { 
        await logAudit(req.user.id, 'CREATE_BANK_TRANSACTION', 'TRANSACTION', null, null, 'FAILURE', e.message, ip);
        res.status(500).json({ error: e.message }); 
    }
});

// --- SERVE FRONTEND ---
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`🌸 FloraManager Server running on port ${PORT}`);
});

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});