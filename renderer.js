// Use modules exposed via preload script
if (!window.electronAPI) {
    console.error('electronAPI not available!');
    document.body.innerHTML = '<div style="padding:20px;text-align:center"><h1>Error</h1><p>Failed to load required modules. Please restart the application.</p></div>';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

if (window.electronAPI?.error) {
    document.body.innerHTML = `<div style="padding:20px;text-align:center"><h1>Module Loading Error</h1><p>${escapeHtml(window.electronAPI.error)}</p></div>`;
}

const axios = window.electronAPI?.axios;
const XLSX = window.electronAPI?.XLSX;

if (!axios || !XLSX) {
    document.body.innerHTML = '<div style="padding:20px;text-align:center"><h1>Error</h1><p>Required modules (axios, XLSX) not loaded. Please run: npm install</p></div>';
}

// ==================== STATE ====================
let products = [];
let cart = [];
let excelUrl = '';
let transactions = [];
let customers = [];
let stockOverrides = {}; // { productId: totalQuantitySold }
let viewingTransactionIndex = null;

const DEFAULT_EXCEL_URL = 'https://docs.google.com/spreadsheets/d/1L4iygFD3mB7jlJNAh97eeBfxkC7VBVYdwkH6Rb7SCMQ/edit?gid=1799151543#gid=1799151543';

// ==================== SETTINGS ====================
let settings = {
    storeName: 'My Store',
    storeAddress: '',
    storePhone: '',
    defaultPriceTier: 'parchon',
    lowStockThreshold: 5,
    darkMode: false,
    language: 'english'
};

// ==================== UI TRANSLATIONS ====================
const I18N = {
    english: {
        appTitle: 'Point of Sale System',
        refreshProducts: 'Refresh Products',
        chooseLocalFile: 'Choose Local File',
        excelUrlPh: 'Excel File URL',
        darkModeTitle: 'Toggle Dark Mode',
        navPos: '🛒 POS',
        navReports: '📊 Reports',
        navSettings: '⚙️ Settings',
        products: 'Products',
        searchPh: 'Search or scan barcode...',
        cart: 'Cart',
        clear: 'Clear',
        customerNamePh: 'Customer name (optional)',
        customerPhonePh: 'Phone (optional)',
        discount: 'Discount:',
        discountFlat: 'Rs. Flat',
        discountPercent: '% Percent',
        creditLabel: 'Mark as Khata / Credit',
        subtotal: 'Subtotal:',
        discountSummary: 'Discount:',
        total: 'Total:',
        checkout: 'Checkout',
        salesReports: 'Sales Reports',
        filterAll: 'All Time',
        filterToday: 'Today',
        filterWeek: 'This Week',
        filterMonth: 'This Month',
        exportExcel: 'Export Excel',
        todayRevenue: "Today's Revenue",
        todayCredit: "Today's Credit (Khata)",
        allTimeRevenue: 'Total Revenue (All Time)',
        outstandingKhata: 'Outstanding Khata',
        totalUnpaidCredit: 'Total unpaid credit',
        transactionHistory: 'Transaction History',
        thDate: 'Date & Time',
        thCustomer: 'Customer',
        thItems: 'Items',
        thDiscount: 'Discount',
        thTotal: 'Total',
        thType: 'Type',
        thAction: 'Action',
        noTransactionsYet: 'No transactions yet',
        settings: 'Settings',
        storeInformation: 'Store Information',
        storeName: 'Store Name',
        storeAddress: 'Store Address',
        phoneNumber: 'Phone Number',
        pricing: 'Pricing',
        defaultPriceTier: 'Default Price Tier',
        tierParchon: 'Parchon',
        tierGatta: 'Gatta',
        tierWholesale: 'Wholesale',
        lowStockThreshold: 'Low Stock Warning Threshold',
        languageSettings: 'Language',
        appLanguage: 'App Language',
        appearance: 'Appearance',
        darkMode: 'Dark Mode',
        stockManagement: 'Stock Management',
        stockTracked: 'Stock is tracked and decremented after each checkout.',
        resetStock: 'Reset Stock to Excel Values',
        saveSettings: 'Save Settings',
        selectReceiptLanguage: 'Select Receipt Language',
        chooseReceiptLang: 'Choose language for receipt:',
        printEnglish: 'Print receipt in English',
        printUrdu: 'Print receipt in Urdu',
        selectPrice: 'Select Price',
        changePrice: 'Change Price',
        customPriceLabel: 'Or Enter Custom Price:',
        cancel: 'Cancel',
        addToCart: 'Add to Cart',
        updatePrice: 'Update Price',
        enterQuantity: 'Enter Quantity',
        enterQtyLabel: 'Enter quantity:',
        qtyExamples: 'Examples: 2.5 kg, 500 gm, 1.5 kgs, or just 2',
        updateQuantity: 'Update Quantity',
        transactionDetails: 'Transaction Details',
        close: 'Close',
        reprintReceipt: 'Reprint Receipt',
        loadingProducts: 'Loading products...',
        cartEmptyMsg: 'Cart is empty',
        cartEmpty: 'Cart is empty',
        noProducts: 'No products found',
        outOfStock: 'Out of Stock',
        addToCartBtn: 'Add to Cart',
        lowStock: 'Low Stock',
        inStock: 'In Stock',
        stock: 'Stock:',
        each: 'each',
        custom: 'Custom',
        view: 'View',
        noTransactionsFound: 'No transactions found',
        badgeKhata: 'Khata',
        badgeCash: 'Cash',
        settingsSaved: 'Settings saved!',
        stockReset: 'Stock reset to Excel values',
        resetStockConfirm: 'This will reset all stock back to original Excel values. Continue?',
        clearCartConfirm: 'Clear the entire cart?',
        cartCleared: 'Cart cleared',
        checkoutComplete: 'Checkout complete! Total: Rs.{total}{credit}',
        creditSuffix: ' (Khata)',
        parchonPrice: 'Parchon Price',
        gattaPrice: 'Gatta Price',
        wholesalePrice: 'Wholesale Price'
    },
    urdu: {
        appTitle: 'پوائنٹ آف سیل سسٹم',
        refreshProducts: 'مصنوعات تازہ کریں',
        chooseLocalFile: 'مقامی فائل منتخب کریں',
        excelUrlPh: 'ایکسل فائل کا لنک',
        darkModeTitle: 'ڈارک موڈ تبدیل کریں',
        navPos: '🛒 پوز',
        navReports: '📊 رپورٹس',
        navSettings: '⚙️ ترتیبات',
        products: 'مصنوعات',
        searchPh: 'تلاش کریں یا بارکوڈ سکین کریں...',
        cart: 'ٹوکری',
        clear: 'صاف کریں',
        customerNamePh: 'گاہک کا نام (اختیاری)',
        customerPhonePh: 'فون (اختیاری)',
        discount: 'رعایت:',
        discountFlat: 'روپے فلیٹ',
        discountPercent: '% فیصد',
        creditLabel: 'خاتہ / ادھار کے طور پر نشان زد کریں',
        subtotal: 'ذیلی کل:',
        discountSummary: 'رعایت:',
        total: 'کل:',
        checkout: 'چیک آؤٹ',
        salesReports: 'فروخت کی رپورٹس',
        filterAll: 'تمام وقت',
        filterToday: 'آج',
        filterWeek: 'اس ہفتے',
        filterMonth: 'اس ماہ',
        exportExcel: 'ایکسل برآمد کریں',
        todayRevenue: 'آج کی آمدنی',
        todayCredit: 'آج کا ادھار (خاتہ)',
        allTimeRevenue: 'کل آمدنی',
        outstandingKhata: 'باقی خاتہ',
        totalUnpaidCredit: 'کل غیر ادا شدہ ادھار',
        transactionHistory: 'لین دین کی تاریخ',
        thDate: 'تاریخ و وقت',
        thCustomer: 'گاہک',
        thItems: 'اشیاء',
        thDiscount: 'رعایت',
        thTotal: 'کل',
        thType: 'قسم',
        thAction: 'عمل',
        noTransactionsYet: 'ابھی کوئی لین دین نہیں',
        settings: 'ترتیبات',
        storeInformation: 'اسٹور کی معلومات',
        storeName: 'اسٹور کا نام',
        storeAddress: 'اسٹور کا پتہ',
        phoneNumber: 'فون نمبر',
        pricing: 'قیمتیں',
        defaultPriceTier: 'ڈیفالٹ قیمت کی قسم',
        tierParchon: 'پرچون',
        tierGatta: 'گٹہ',
        tierWholesale: 'تھوک',
        lowStockThreshold: 'کم اسٹاک کی وارننگ',
        languageSettings: 'زبان',
        appLanguage: 'ایپ کی زبان',
        appearance: 'ظاہری شکل',
        darkMode: 'ڈارک موڈ',
        stockManagement: 'اسٹاک کا انتظام',
        stockTracked: 'چیک آؤٹ کے بعد اسٹاک کم ہو جاتا ہے۔',
        resetStock: 'اسٹاک ایکسل کی قدروں پر بحال کریں',
        saveSettings: 'ترتیبات محفوظ کریں',
        selectReceiptLanguage: 'رسید کی زبان منتخب کریں',
        chooseReceiptLang: 'رسید کی زبان منتخب کریں:',
        printEnglish: 'انگریزی میں رسید پرنٹ کریں',
        printUrdu: 'اردو میں رسید پرنٹ کریں',
        selectPrice: 'قیمت منتخب کریں',
        changePrice: 'قیمت تبدیل کریں',
        customPriceLabel: 'یا اپنی قیمت درج کریں:',
        cancel: 'منسوخ',
        addToCart: 'ٹوکری میں شامل کریں',
        updatePrice: 'قیمت اپڈیٹ کریں',
        enterQuantity: 'مقدار درج کریں',
        enterQtyLabel: 'مقدار درج کریں:',
        qtyExamples: 'مثال: 2.5 kg، 500 gm، یا صرف 2',
        updateQuantity: 'مقدار اپڈیٹ کریں',
        transactionDetails: 'لین دین کی تفصیل',
        close: 'بند کریں',
        reprintReceipt: 'رسید دوبارہ پرنٹ کریں',
        loadingProducts: 'مصنوعات لوڈ ہو رہی ہیں...',
        cartEmptyMsg: 'ٹوکری خالی ہے',
        cartEmpty: 'ٹوکری خالی ہے',
        noProducts: 'کوئی مصنوعات نہیں ملی',
        outOfStock: 'اسٹاک ختم',
        addToCartBtn: 'ٹوکری میں شامل کریں',
        lowStock: 'کم اسٹاک',
        inStock: 'دستیاب',
        stock: 'اسٹاک:',
        each: 'فی عدد',
        custom: 'خصوصی',
        view: 'دیکھیں',
        noTransactionsFound: 'کوئی لین دین نہیں ملا',
        badgeKhata: 'خاتہ',
        badgeCash: 'نقد',
        settingsSaved: 'ترتیبات محفوظ ہو گئیں!',
        stockReset: 'اسٹاک ایکسل کی قدروں پر بحال ہو گیا',
        resetStockConfirm: 'یہ تمام اسٹاک کو ایکسل کی اصل قدروں پر بحال کر دے گا۔ جاری رکھیں؟',
        clearCartConfirm: 'پوری ٹوکری صاف کریں؟',
        cartCleared: 'ٹوکری صاف ہو گئی',
        checkoutComplete: 'چیک آؤٹ مکمل! کل: Rs.{total}{credit}',
        creditSuffix: ' (خاتہ)',
        parchonPrice: 'پرچون قیمت',
        gattaPrice: 'گٹہ قیمت',
        wholesalePrice: 'تھوک قیمت'
    }
};

function t(key, vars = {}) {
    const lang = settings.language === 'urdu' ? 'urdu' : 'english';
    let text = I18N[lang][key] ?? I18N.english[key] ?? key;
    Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
    });
    return text;
}

function applyLanguage() {
    const isUrdu = settings.language === 'urdu';
    document.documentElement.lang = isUrdu ? 'ur' : 'en';
    document.documentElement.dir = isUrdu ? 'rtl' : 'ltr';
    document.body.classList.toggle('lang-urdu', isUrdu);
    document.title = t('appTitle');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPh);
    });

    const setText = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.textContent = t(key);
    };
    const setPh = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.placeholder = t(key);
    };
    const setTitle = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.title = t(key);
    };

    setText('refreshBtn', 'refreshProducts');
    setText('fileBtn', 'chooseLocalFile');
    setPh('excelUrlInput', 'excelUrlPh');
    setTitle('darkModeBtn', 'darkModeTitle');
    setText('clearCartBtn', 'clear');
    setText('checkoutBtn', 'checkout');
    setPh('searchInput', 'searchPh');
    setPh('customerNameInput', 'customerNamePh');
    setPh('customerPhoneInput', 'customerPhonePh');

    const langSelect = document.getElementById('settingsLanguage');
    if (langSelect) langSelect.value = settings.language === 'urdu' ? 'urdu' : 'english';

    const loadingGrid = document.getElementById('productsGrid');
    if (loadingGrid?.querySelector('.loading') && !products.length) {
        loadingGrid.innerHTML = `<div class="loading">${t('loadingProducts')}</div>`;
    }

    if (products.length) displayProducts(getFilteredProducts());
    updateCart();
    if (document.getElementById('reportsPanel')?.style.display !== 'none') renderReports();
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('pos_settings');
        if (saved) {
            settings = { ...settings, ...JSON.parse(saved) };
            settings.language = settings.language === 'urdu' ? 'urdu' : 'english';
        }
    } catch (e) { /* ignore */ }
}

function saveSettings() {
    localStorage.setItem('pos_settings', JSON.stringify(settings));
}

function applyDarkMode() {
    document.body.classList.toggle('dark-mode', settings.darkMode);
    const btn = document.getElementById('darkModeBtn');
    if (btn) btn.textContent = settings.darkMode ? '☀️' : '🌙';
    const toggle = document.getElementById('settingsDarkMode');
    if (toggle) toggle.checked = settings.darkMode;
}

function toggleDarkMode() {
    settings.darkMode = !settings.darkMode;
    applyDarkMode();
    saveSettings();
}

function populateSettingsForm() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    set('settingsStoreName', settings.storeName);
    set('settingsStoreAddress', settings.storeAddress);
    set('settingsStorePhone', settings.storePhone);
    set('settingsDefaultPriceTier', settings.defaultPriceTier);
    set('settingsLowStockThreshold', settings.lowStockThreshold);
    const lang = document.getElementById('settingsLanguage');
    if (lang) lang.value = settings.language === 'urdu' ? 'urdu' : 'english';
    const dm = document.getElementById('settingsDarkMode');
    if (dm) dm.checked = settings.darkMode;
}

function saveSettingsFromForm() {
    const get = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    settings.storeName = get('settingsStoreName') || 'My Store';
    settings.storeAddress = get('settingsStoreAddress');
    settings.storePhone = get('settingsStorePhone');
    settings.defaultPriceTier = get('settingsDefaultPriceTier') || 'parchon';
    settings.lowStockThreshold = parseInt(get('settingsLowStockThreshold')) || 5;
    const lang = document.getElementById('settingsLanguage');
    settings.language = lang?.value === 'urdu' ? 'urdu' : 'english';
    const dm = document.getElementById('settingsDarkMode');
    settings.darkMode = dm ? dm.checked : false;
    saveSettings();
    applyDarkMode();
    applyLanguage();
    const nameEl = document.getElementById('headerStoreName');
    if (nameEl) nameEl.textContent = settings.storeName;
    showNotification(t('settingsSaved'), 'success');
}

// ==================== STOCK TRACKING ====================
function loadStockOverrides() {
    try {
        const saved = localStorage.getItem('pos_stock_overrides');
        if (saved) stockOverrides = JSON.parse(saved);
    } catch (e) { stockOverrides = {}; }
}

function saveStockOverrides() {
    localStorage.setItem('pos_stock_overrides', JSON.stringify(stockOverrides));
}

function resetStockOverrides() {
    if (!confirm(t('resetStockConfirm'))) return;
    stockOverrides = {};
    saveStockOverrides();
    displayProducts(products);
    showNotification(t('stockReset'), 'success');
}

function getEffectiveStock(product) {
    const sold = stockOverrides[product.id] || 0;
    return Math.max(0, product.stock - sold);
}

function decrementStockForCart(cartSnapshot) {
    cartSnapshot.forEach(item => {
        stockOverrides[item.id] = (stockOverrides[item.id] || 0) + item.quantity;
    });
    saveStockOverrides();
}

// ==================== FILE STORAGE (IPC) ====================
const storage = {
    read: async (filename) => {
        if (!window.electronAPI?.storage) return null;
        return window.electronAPI.storage.read(filename);
    },
    write: async (filename, data) => {
        if (!window.electronAPI?.storage) return false;
        return window.electronAPI.storage.write(filename, data);
    }
};

async function loadTransactions() {
    const data = await storage.read('transactions.json');
    if (Array.isArray(data)) transactions = data;
}

async function persistTransaction(tx) {
    transactions.unshift(tx); // newest first
    await storage.write('transactions.json', transactions);
}

async function loadCustomers() {
    const data = await storage.read('customers.json');
    if (Array.isArray(data)) customers = data;
}

async function ensureCustomer(name, phone) {
    if (!name) return;
    const exists = customers.find(c => c.name === name);
    if (!exists) {
        customers.push({ id: Date.now(), name, phone: phone || '', firstSeen: new Date().toISOString() });
        await storage.write('customers.json', customers);
    }
}

// ==================== DOM REFS ====================
let productsGrid, cartItems, searchInput, loadBtn, refreshBtn, excelUrlInput;
let fileInput, fileBtn, clearCartBtn, checkoutBtn;
let totalEl, subtotalEl, notification;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
    productsGrid = document.getElementById('productsGrid');
    cartItems = document.getElementById('cartItems');
    searchInput = document.getElementById('searchInput');
    loadBtn = document.getElementById('loadBtn');
    refreshBtn = document.getElementById('refreshBtn');
    excelUrlInput = document.getElementById('excelUrlInput');
    fileInput = document.getElementById('fileInput');
    fileBtn = document.getElementById('fileBtn');
    clearCartBtn = document.getElementById('clearCartBtn');
    checkoutBtn = document.getElementById('checkoutBtn');
    totalEl = document.getElementById('total');
    subtotalEl = document.getElementById('subtotal');
    notification = document.getElementById('notification');

    // Load persisted data
    loadSettings();
    loadStockOverrides();
    await loadTransactions();
    await loadCustomers();

    // Apply settings to UI
    applyDarkMode();
    applyLanguage();
    const nameEl = document.getElementById('headerStoreName');
    if (nameEl) nameEl.textContent = settings.storeName;

    // URL init
    const storedUrl = localStorage.getItem('excelUrl');
    const oldSheetIds = [
        '1n4Qvos_RZLgex2pxisiJGYjgneDbmujRkJuRE-W0bEM',
        '1mBy447WJ_QUle4MUA-GhZplP8UMowmuSJj6awjki5yQ'
    ];
    const isOldUrl = storedUrl && (
        storedUrl.includes('onedrive') ||
        storedUrl.includes('excel.cloud.microsoft') ||
        oldSheetIds.some(id => storedUrl.includes(id))
    );
    excelUrlInput.value = (isOldUrl || !storedUrl) ? DEFAULT_EXCEL_URL : storedUrl;
    excelUrl = excelUrlInput.value;

    // Event listeners
    if (refreshBtn) refreshBtn.addEventListener('click', loadExcel);
    if (loadBtn) loadBtn.addEventListener('click', loadExcel);

    if (fileBtn && fileInput) {
        fileBtn.addEventListener('click', (e) => { e.preventDefault(); fileInput.click(); });
        fileInput.addEventListener('change', handleFileSelect);
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
        searchInput.addEventListener('keyup', filterProducts);
        setupBarcodeScanner();
    }

    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);

    // Dark mode button
    const darkBtn = document.getElementById('darkModeBtn');
    if (darkBtn) darkBtn.addEventListener('click', toggleDarkMode);

    // Discount live update
    const discountAmount = document.getElementById('discountAmount');
    const discountType = document.getElementById('discountType');
    if (discountAmount) discountAmount.addEventListener('input', updateSummary);
    if (discountType) discountType.addEventListener('change', updateSummary);

    // Nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const panelId = tab.dataset.panel;
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
            tab.classList.add('active');
            const panel = document.getElementById(panelId);
            if (panel) panel.style.display = 'block';
            if (panelId === 'reportsPanel') renderReports();
            if (panelId === 'settingsPanel') populateSettingsForm();
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);

    // Close modals on backdrop click
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('priceModal')) closePriceModal();
        if (e.target === document.getElementById('languageModal')) closeLanguageModal();
        if (e.target === document.getElementById('quantityModal')) closeQuantityModal();
        if (e.target === document.getElementById('receiptDetailModal')) closeReceiptDetailModal();
    });

    loadExcel();
});

// ==================== KEYBOARD SHORTCUTS ====================
function handleGlobalKeydown(e) {
    // Escape: close any open modal
    if (e.key === 'Escape') {
        closePriceModal();
        closeLanguageModal();
        closeQuantityModal();
        closeReceiptDetailModal();
    }
    // Ctrl+P: print (checkout flow)
    if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        if (cart.length > 0) checkout();
    }
    // Ctrl+F: focus search
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        if (searchInput) searchInput.focus();
    }
}

// ==================== BARCODE SCANNER ====================
let barcodeBuffer = '';
let barcodeLastTime = 0;
const BARCODE_SPEED_MS = 60;

function setupBarcodeScanner() {
    searchInput.addEventListener('keydown', (e) => {
        const now = Date.now();
        if (e.key === 'Enter') {
            e.preventDefault();
            // Fast input → scanner mode: try barcode lookup first
            if (now - barcodeLastTime < BARCODE_SPEED_MS * 2 && barcodeBuffer.length > 2) {
                const barcode = barcodeBuffer.trim();
                const match = products.find(p => p.barcode && p.barcode === barcode);
                if (match) {
                    addToCart(match.id);
                    searchInput.value = '';
                    barcodeBuffer = '';
                    filterProducts();
                    return;
                }
            }
            // Keyboard Enter: add first visible filtered product
            const filtered = getFilteredProducts();
            if (filtered.length > 0) {
                addToCart(filtered[0].id);
            }
            return;
        }
        // Track rapid input for barcode scanner detection
        if (now - barcodeLastTime < BARCODE_SPEED_MS) {
            if (e.key.length === 1) barcodeBuffer += e.key;
        } else {
            barcodeBuffer = e.key.length === 1 ? e.key : '';
        }
        barcodeLastTime = now;
    });
}

function getFilteredProducts() {
    if (!searchInput) return products;
    const term = searchInput.value.toLowerCase().trim();
    if (!term) return products;
    return products.filter(p => {
        return String(p.name || '').toLowerCase().includes(term) ||
               String(p.nameUrdu || '').toLowerCase().includes(term) ||
               String(p.category || '').toLowerCase().includes(term) ||
               String(p.barcode || '').toLowerCase().includes(term);
    });
}

// ==================== FILE HANDLING ====================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        showNotification('Please select a valid Excel file (.xlsx or .xls)', 'error');
        return;
    }
    showNotification('Loading products from file...', 'info');
    productsGrid.innerHTML = `<div class="loading">Reading ${escapeHtml(file.name)}...</div>`;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            processExcelData(new Uint8Array(e.target.result));
        } catch (err) {
            showNotification('Error reading file: ' + err.message, 'error');
            productsGrid.innerHTML = `<div class="error">Failed to read file: ${escapeHtml(err.message)}</div>`;
        }
    };
    reader.onerror = () => {
        showNotification('Error reading file', 'error');
        productsGrid.innerHTML = '<div class="error">Failed to read file.</div>';
    };
    reader.readAsArrayBuffer(file);
}

// Parse numeric prices from Excel cells that may be numbers, strings, or formatted (commas, currency).
// Plain parseFloat() often returns NaN for values like "1,234.56" or "Rs. 100", which makes every row fail validation.
function parsePriceCell(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let s = String(value).trim().replace(/\s+/g, ' ');
    if (!s) return 0;
    // Strip common currency / unit noise at start (PKR, Rs., $, etc.)
    s = s.replace(/^(?:PKR|Rs\.?|RS\.?|USD|EUR|GBP|\$|€|£)\s*/i, '').trim();
    // Keep digits, separators, minus
    let t = s.replace(/[^\d.,-]/g, '');
    if (!t || t === '-') return 0;
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
        // If the rightmost separator is comma, treat comma as decimal (e.g. 1.234,56)
        if (lastComma > lastDot) {
            t = t.replace(/\./g, '').replace(',', '.');
        } else {
            t = t.replace(/,/g, '');
        }
    } else if (lastComma !== -1 && lastDot === -1) {
        const parts = t.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            t = parts[0].replace(/\./g, '') + '.' + parts[1];
        } else {
            t = t.replace(/,/g, '');
        }
    } else {
        t = t.replace(/,/g, '');
    }
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
}

// ==================== EXCEL PROCESSING ====================
function processExcelData(arrayBuffer) {
    try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        if (!workbook.SheetNames?.length) throw new Error('Excel file contains no sheets');

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        let data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (data.length === 0) {
            data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            if (data.length > 1) {
                const headers = data[0];
                data = data.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((h, i) => { obj[h] = row[i]; });
                    return obj;
                });
            }
        }

        if (data.length === 0) throw new Error('Excel file is empty or contains no data rows');

        const allColumns = Object.keys(data[0]);

        const urduColumn = allColumns.find(c => /name.*urdu|urdu.*name/i.test(c) || c.toLowerCase().includes('urdu'));
        const englishColumn = allColumns.find(c => /name.*english|english.*name/i.test(c) || (c.toLowerCase().includes('name') && !c.toLowerCase().includes('urdu'))) || allColumns.find(c => /^name$/i.test(c));
        const imageColumn = allColumns.find(c => /image|photo|picture|img/i.test(c));

        const rawProducts = data.map((row, index) => {
            let name = '';
            if (englishColumn && row[englishColumn]) {
                name = row[englishColumn];
            } else {
                name = row['Name (English)'] || row['name (english)'] || row['Name(English)'] ||
                       row.Name || row.name || row.Product || row.product || row['Product Name'] || row.Item || 'Unknown';
            }

            let nameUrdu = '';
            if (urduColumn && row[urduColumn]) nameUrdu = row[urduColumn];
            else nameUrdu = row['Name (Urdu)'] || row['name (urdu)'] || row['Urdu Name'] || row['urdu name'] || '';

            const barcode = row.Barcode || row.barcode || row.SKU || row.sku || row['Product Code'] || '';
            const unit = String(row.Unit || row.unit || row['Unit Type'] || row.Type || 'Kg').trim();

            const parchonPrice = parsePriceCell(row['Parchon Price'] ?? row['parchon price'] ?? row.ParchonPrice ?? row['ParchonPrice']);
            const gattaPrice = parsePriceCell(row['Gatta Price'] ?? row['gatta price'] ?? row.GattaPrice ?? row['GattaPrice']);
            const wholesalePrice = parsePriceCell(row['Wholesale Price'] ?? row['wholesale price'] ?? row.WholesalePrice ?? row['WholesalePrice']);

            const defaultPrice = parchonPrice > 0 ? parchonPrice : (gattaPrice > 0 ? gattaPrice : wholesalePrice);

            const stock = parseInt(row.Stock || row.stock || row.Quantity || row.quantity || row['In Stock'] || 999);
            const category = row.Category || row.category || row['Product Category'] || 'General';

            const imageUrl = imageColumn ? String(row[imageColumn] || '').trim() : '';

            return {
                id: index + 1,
                name: String(name).trim(),
                price: defaultPrice,
                stock: stock,
                category: String(category).trim(),
                barcode: String(barcode).trim(),
                nameUrdu: String(nameUrdu).trim(),
                unit: unit,
                imageUrl: imageUrl,
                parchonPrice,
                gattaPrice,
                wholesalePrice,
                // Legacy aliases
                parchonMinPrice: parchonPrice, parchonMaxPrice: parchonPrice,
                gattaMinPrice: gattaPrice, gattaMaxPrice: gattaPrice,
                wholesaleMinPrice: wholesalePrice, wholesaleMaxPrice: wholesalePrice
            };
        });

        products = rawProducts.filter(p => p.name !== 'Unknown' && p.name !== '' && p.price > 0);

        if (products.length === 0) {
            throw new Error(`No valid products found. Available columns: ${allColumns.join(', ')}`);
        }

        displayProducts(products);
        showNotification(`Loaded ${products.length} products successfully`, 'success');
    } catch (error) {
        showNotification('Error processing Excel: ' + error.message, 'error');
        productsGrid.innerHTML = `<div class="error"><p><strong>Failed to process Excel file</strong></p><p style="font-size:12px;margin-top:10px">${escapeHtml(error.message)}</p></div>`;
    }
}

// ==================== URL CONVERSION ====================
function convertGoogleDriveUrl(url) {
    if (url.includes('docs.google.com/spreadsheets')) {
        const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (sheetIdMatch) {
            const sheetId = sheetIdMatch[1];
            const gidMatch = url.match(/[?&#]gid=(\d+)/);
            if (gidMatch) return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gidMatch[1]}`;
            return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
        }
        return url;
    }
    if (url.includes('drive.google.com')) {
        const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        const fileId = (m1 && m1[1]) || (m2 && m2[1]);
        if (fileId) return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    if (url.includes('dropbox.com')) {
        return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').split('?')[0];
    }
    if (url.includes('onedrive') || url.includes('1drv.ms') || url.includes('excel.cloud.microsoft') || url.includes('sharepoint.com')) {
        return convertOneDriveUrl(url);
    }
    return url;
}

function convertOneDriveUrl(url) {
    try {
        if (url.includes('excel.cloud.microsoft')) {
            const urlObj = new URL(url);
            const docId = urlObj.searchParams.get('docId');
            const driveId = urlObj.searchParams.get('driveId');
            if (docId && driveId) {
                const parts = docId.split('!');
                const itemId = parts.length > 1 ? parts[1] : parts[0];
                return `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;
            }
        }
        if (url.includes('onedrive.live.com')) {
            const match = url.match(/resid=([^&]+)/);
            if (match) return `https://onedrive.live.com/download?resid=${encodeURIComponent(decodeURIComponent(match[1]))}`;
        }
        return url;
    } catch (e) { return url; }
}

async function loadExcel() {
    const url = excelUrlInput.value.trim();
    if (!url) { showNotification('Please enter an Excel file URL', 'error'); return; }

    excelUrl = url;
    localStorage.setItem('excelUrl', url);
    showNotification('Loading products...', 'info');
    productsGrid.innerHTML = `<div class="loading">Loading products...<br><small>This may take a moment...</small></div>`;

    const loadingTimeout = setTimeout(() => {
        productsGrid.innerHTML = '<div class="loading">Still loading...<br><small>If this takes too long, try "Choose Local File"</small></div>';
    }, 5000);

    try {
        const isOneDrive = !url.includes('docs.google.com') && (url.includes('onedrive') || url.includes('excel.cloud.microsoft') || url.includes('sharepoint'));
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000));

        if (isOneDrive) {
            await Promise.race([tryOneDriveMethods(url), timeout]);
        } else {
            await Promise.race([trySingleMethod(url), timeout]);
        }
        clearTimeout(loadingTimeout);
    } catch (error) {
        clearTimeout(loadingTimeout);
        let msg = error.message.includes('timeout') ? 'Request timed out. Try "Choose Local File".' : (error.message || 'Unknown error');
        showNotification('Failed to load: ' + msg, 'error');
        productsGrid.innerHTML = `<div class="error"><p><strong>Failed to load products</strong></p><p style="font-size:13px;margin-top:10px">${escapeHtml(msg)}</p><p style="font-size:12px;margin-top:10px">Try clicking "Choose Local File" to load from your computer.</p></div>`;
    }
}

async function trySingleMethod(url) {
    const downloadUrl = convertGoogleDriveUrl(url);
    const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, */*' },
        maxRedirects: 5
    });
    const size = response.data?.byteLength ?? response.data?.length ?? 0;
    if (!response.data || size === 0) throw new Error('Empty response from server');
    processExcelData(response.data);
}

async function tryOneDriveMethods(url) {
    const methods = [{ url: convertGoogleDriveUrl(url), name: 'Graph API' }];
    for (let i = 0; i < methods.length; i++) {
        try {
            const response = await axios.get(methods[i].url, {
                responseType: 'arraybuffer', timeout: 10000,
                validateStatus: (s) => s < 500
            });
            if (response.status === 200 && response.data?.length > 0) {
                processExcelData(response.data); return;
            }
            if (response.status === 401 || response.status === 403) {
                throw new Error('OneDrive file requires authentication. Please download and use "Choose Local File".');
            }
        } catch (err) {
            if (i === methods.length - 1) throw err;
        }
    }
}

// ==================== DISPLAY PRODUCTS ====================
function displayProducts(productsToShow) {
    if (!productsGrid) return;
    if (!productsToShow?.length) {
        productsGrid.innerHTML = `<div class="empty">${t('noProducts')}</div>`;
        return;
    }

    try {
        productsGrid.innerHTML = productsToShow.map(product => {
            if (!product.name || !product.price) return '';

            const effectiveStock = getEffectiveStock(product);
            const isLowStock = product.stock !== 999 && effectiveStock > 0 && effectiveStock <= settings.lowStockThreshold;
            const isOutOfStock = effectiveStock === 0;

            const safeName = escapeHtml(product.name);
            const safeNameUrdu = escapeHtml(product.nameUrdu);
            const safeCategory = escapeHtml(product.category);

            const nameDisplay = product.nameUrdu
                ? `${safeName}<br><small style="color:var(--text-muted);font-size:0.85em">${safeNameUrdu}</small>`
                : safeName;

            const displayPrice = product.parchonPrice || product.gattaPrice || product.wholesalePrice || product.price;

            const imageHtml = product.imageUrl
                ? `<img src="${escapeHtml(product.imageUrl)}" class="product-image" alt="${safeName}" onerror="this.style.display='none'">`
                : '';

            const pricesHtml = (product.parchonPrice > 0 || product.gattaPrice > 0 || product.wholesalePrice > 0) ? `
                <div class="product-prices-mini">
                    ${product.parchonPrice > 0 ? `Parchon: Rs.${product.parchonPrice.toFixed(2)}` : ''}
                    ${product.parchonPrice > 0 && product.gattaPrice > 0 ? ' | ' : ''}
                    ${product.gattaPrice > 0 ? `Gatta: Rs.${product.gattaPrice.toFixed(2)}` : ''}
                    ${(product.parchonPrice > 0 || product.gattaPrice > 0) && product.wholesalePrice > 0 ? ' | ' : ''}
                    ${product.wholesalePrice > 0 ? `Wholesale: Rs.${product.wholesalePrice.toFixed(2)}` : ''}
                </div>` : '';

            const stockDisplay = product.stock === 999 ? t('inStock') : `${t('stock')} ${effectiveStock}`;

            return `
                <div class="product-card" data-id="${product.id}">
                    ${isLowStock ? `<div class="low-stock-badge">${t('lowStock')}</div>` : ''}
                    ${imageHtml}
                    <div class="product-info">
                        <h3 class="product-name">${nameDisplay}</h3>
                        <p class="product-category">${safeCategory}</p>
                        <div class="product-details">
                            <span class="product-price">Rs.${displayPrice.toFixed(2)}</span>
                            <span class="product-stock" style="${isLowStock ? 'color:var(--danger);font-weight:600' : ''}">${stockDisplay}</span>
                        </div>
                        ${pricesHtml}
                    </div>
                    <button class="btn btn-add" onclick="addToCart(${product.id})" ${isOutOfStock ? 'disabled' : ''}>
                        ${isOutOfStock ? t('outOfStock') : t('addToCartBtn')}
                    </button>
                </div>
            `;
        }).filter(Boolean).join('');
    } catch (err) {
        productsGrid.innerHTML = `<div class="error">Error displaying products: ${escapeHtml(err.message)}</div>`;
    }
}

// ==================== FILTER ====================
function filterProducts() {
    if (!searchInput) return;
    displayProducts(getFilteredProducts());
}

// ==================== PRICE MODAL ====================
let selectedProductForPrice = null;
let selectedPrice = null;
let editingCartItemIndex = null;

function showPriceModal(product, cartItemIndex = null) {
    selectedProductForPrice = product;
    editingCartItemIndex = cartItemIndex;

    if (cartItemIndex !== null && cart[cartItemIndex]) {
        selectedPrice = cart[cartItemIndex].price;
    } else {
        // Default price tier from settings
        const tier = settings.defaultPriceTier;
        if (tier === 'gatta' && product.gattaPrice > 0) selectedPrice = product.gattaPrice;
        else if (tier === 'wholesale' && product.wholesalePrice > 0) selectedPrice = product.wholesalePrice;
        else selectedPrice = product.parchonPrice || product.gattaPrice || product.wholesalePrice || product.price;
    }

    const modal = document.getElementById('priceModal');
    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('customPriceInput').value = selectedPrice.toFixed(2);

    const modalTitle = modal.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = cartItemIndex !== null ? t('changePrice') : t('selectPrice');

    let optionsHTML = '';
    if (product.parchonPrice > 0) optionsHTML += priceOptionHTML(t('parchonPrice'), product.parchonPrice, selectedPrice);
    if (product.gattaPrice > 0) optionsHTML += priceOptionHTML(t('gattaPrice'), product.gattaPrice, selectedPrice);
    if (product.wholesalePrice > 0) optionsHTML += priceOptionHTML(t('wholesalePrice'), product.wholesalePrice, selectedPrice);
    document.getElementById('priceOptions').innerHTML = optionsHTML;

    const confirmBtn = document.getElementById('confirmPriceBtn') || modal.querySelector('.modal-footer .btn-primary');
    if (confirmBtn) confirmBtn.textContent = cartItemIndex !== null ? t('updatePrice') : t('addToCart');

    modal.style.display = 'block';
}

function priceOptionHTML(label, price, selected) {
    return `
        <div class="price-option ${Math.abs(selected - price) < 0.01 ? 'selected' : ''}" onclick="selectPrice(${price})">
            <div class="price-option-label">${label}</div>
            <div class="price-option-value">Rs.${price.toFixed(2)}</div>
        </div>`;
}

function closePriceModal() {
    const modal = document.getElementById('priceModal');
    if (modal) modal.style.display = 'none';
    selectedProductForPrice = null;
    selectedPrice = null;
    editingCartItemIndex = null;
}

function selectPrice(price) {
    selectedPrice = price;
    document.getElementById('customPriceInput').value = price.toFixed(2);
    document.querySelectorAll('.price-option').forEach(opt => {
        const optPrice = parseFloat(opt.querySelector('.price-option-value').textContent.replace('Rs.', ''));
        opt.classList.toggle('selected', Math.abs(optPrice - price) < 0.01);
    });
}

function confirmPriceSelection() {
    if (!selectedProductForPrice) return;
    const customPrice = parseFloat(document.getElementById('customPriceInput').value);
    if (isNaN(customPrice) || customPrice < 0) {
        showNotification('Please enter a valid price', 'error');
        return;
    }
    const finalPrice = customPrice > 0 ? customPrice : selectedPrice;

    if (editingCartItemIndex !== null && cart[editingCartItemIndex]) {
        cart[editingCartItemIndex].price = finalPrice;
        cart[editingCartItemIndex].customPrice = finalPrice;
        updateCart();
        showNotification(`Price updated to Rs.${finalPrice.toFixed(2)}`, 'success');
    } else {
        addToCartWithPrice(selectedProductForPrice.id, finalPrice);
    }
    closePriceModal();
}

// ==================== CART ====================
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const effectiveStock = getEffectiveStock(product);
    if (effectiveStock === 0) {
        showNotification('Product is out of stock', 'error');
        return;
    }
    showPriceModal(product);
}

function addToCartWithPrice(productId, price) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const effectiveStock = getEffectiveStock(product);
    if (effectiveStock === 0) {
        showNotification('Product is out of stock', 'error');
        return;
    }

    const existing = cart.find(item => item.id === productId && Math.abs(item.price - price) < 0.01);
    if (existing) {
        if (product.stock !== 999 && existing.quantity >= effectiveStock) {
            showNotification('Not enough stock available', 'error');
            return;
        }
        existing.quantity++;
    } else {
        cart.push({
            ...product,
            price,
            customPrice: Math.abs(price - product.price) > 0.01 ? price : undefined,
            originalPrice: product.price,
            quantity: 1,
            unit: product.unit || 'Kg'
        });
    }

    updateCart();
    showNotification(`${product.name} added to cart`, 'success');
}

function removeFromCartByIndex(itemIndex) {
    if (itemIndex < 0 || itemIndex >= cart.length) return;
    const item = cart[itemIndex];
    if (!confirm(`Remove "${item.name}" from cart?`)) return;
    cart.splice(itemIndex, 1);
    updateCart();
}

function editCartItemPrice(itemIndex) {
    if (itemIndex < 0 || itemIndex >= cart.length) return;
    const product = products.find(p => p.id === cart[itemIndex].id);
    if (!product) { showNotification('Product not found', 'error'); return; }
    showPriceModal(product, itemIndex);
}

function updateQuantityByIndex(itemIndex, change) {
    if (itemIndex < 0 || itemIndex >= cart.length) return;
    const cartItem = cart[itemIndex];
    const product = products.find(p => p.id === cartItem.id);
    const unit = (cartItem.unit || product?.unit || 'Kg').toLowerCase();

    const isPack = ['pack', 'packs', 'pcs', 'piece', 'pieces'].includes(unit);
    const step = isPack ? (change > 0 ? 1 : -1) : (change > 0 ? 0.1 : -0.1);

    const newQty = Math.max(0, parseFloat((cartItem.quantity + step).toFixed(3)));

    if (newQty <= 0) {
        cart.splice(itemIndex, 1);
        updateCart();
        return;
    }

    const effectiveStock = product ? getEffectiveStock(product) : 999;
    if (product?.stock !== 999 && newQty > effectiveStock) {
        showNotification('Not enough stock available', 'error');
        return;
    }

    cartItem.quantity = newQty;
    if (!cartItem.unit && product) cartItem.unit = product.unit || 'Kg';
    updateCart();
}

// Legacy compat
function updateQuantity(productId, change) {
    const idx = cart.findIndex(i => i.id === productId);
    if (idx >= 0) updateQuantityByIndex(idx, change);
}
function removeFromCart(productId) {
    const idx = cart.findIndex(i => i.id === productId);
    if (idx >= 0) removeFromCartByIndex(idx);
}

// ==================== QUANTITY MODAL ====================
let editingQuantityItemIndex = null;

function editQuantity(itemIndex) {
    if (itemIndex < 0 || itemIndex >= cart.length) return;
    const cartItem = cart[itemIndex];
    const product = products.find(p => p.id === cartItem.id);
    if (!product) return;

    editingQuantityItemIndex = itemIndex;
    const modal = document.getElementById('quantityModal');
    const unit = product.unit || 'Kg';
    document.getElementById('quantityModalProductName').textContent = `${product.name} (Unit: ${unit})`;

    const input = document.getElementById('quantityInput');
    input.value = formatQuantity(cartItem.quantity, unit);

    const unitLower = unit.toLowerCase();
    if (unitLower === 'kg' || unitLower === 'kilogram') {
        input.placeholder = 'e.g., 2.5 kg or 500 gm';
    } else if (unitLower === 'liter' || unitLower === 'litre' || unitLower === 'l') {
        input.placeholder = 'e.g., 2.5 Liter or 500 ml';
    } else {
        input.placeholder = `e.g., 3 ${unit}`;
    }

    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmQuantitySelection(); } };
    modal.style.display = 'block';
    setTimeout(() => { input.focus(); input.select(); }, 100);
}

function closeQuantityModal() {
    const modal = document.getElementById('quantityModal');
    if (modal) modal.style.display = 'none';
    editingQuantityItemIndex = null;
    const input = document.getElementById('quantityInput');
    if (input) input.value = '';
}

function confirmQuantitySelection() {
    if (editingQuantityItemIndex === null) return;
    const input = document.getElementById('quantityInput');
    const val = input.value.trim();
    if (!val) { showNotification('Please enter a quantity', 'error'); return; }

    const cartItem = cart[editingQuantityItemIndex];
    const product = products.find(p => p.id === cartItem.id);
    const unit = product?.unit || 'Kg';
    const qty = parseQuantity(val, unit);

    if (qty <= 0) { showNotification('Quantity must be greater than 0', 'error'); return; }

    const effectiveStock = product ? getEffectiveStock(product) : 999;
    if (product?.stock !== 999 && qty > effectiveStock) {
        showNotification('Not enough stock available', 'error');
        return;
    }

    cartItem.quantity = qty;
    if (!cartItem.unit) cartItem.unit = unit;
    updateCart();
    showNotification(`Quantity updated to ${formatQuantity(qty, unit)}`, 'success');
    closeQuantityModal();
}

// ==================== QUANTITY FORMAT/PARSE ====================
function formatQuantity(quantity, unit = 'Kg') {
    if (quantity <= 0) return '0';
    const u = String(unit).toLowerCase().trim();
    if (u === 'kg' || u === 'kilogram' || u === 'kgs') {
        return quantity >= 1
            ? `${quantity.toFixed(quantity % 1 === 0 ? 0 : 2)} kg`
            : `${Math.round(quantity * 1000)} gm`;
    }
    if (u === 'liter' || u === 'litre' || u === 'l' || u === 'liters' || u === 'litres') {
        return quantity >= 1
            ? `${quantity.toFixed(quantity % 1 === 0 ? 0 : 2)} Liter`
            : `${Math.round(quantity * 1000)} ml`;
    }
    if (u === 'pack' || u === 'packs' || u === 'pcs' || u === 'piece' || u === 'pieces') {
        return `${Math.round(quantity)} ${String(unit).trim()}`;
    }
    return `${quantity.toFixed(quantity % 1 === 0 ? 0 : 2)} ${String(unit).trim()}`;
}

function parseQuantity(input, unit = 'Kg') {
    if (!input || typeof input !== 'string') return parseFloat(input) || 0;
    const t = input.trim().toLowerCase();
    const m = t.match(/^([\d.]+)/);
    if (!m) return 0;
    const v = parseFloat(m[1]);
    if (isNaN(v)) return 0;
    if (t.includes('gm') || t.includes('gram')) return v / 1000;
    if (t.includes('ml') || t.includes('milliliter') || t.includes('millilitre')) return v / 1000;
    if (t.includes('kg') || t.includes('kilogram')) return v;
    if (t.includes('liter') || t.includes('litre')) return v;
    return v;
}

// ==================== UPDATE CART DISPLAY ====================
function updateCart() {
    if (cart.length === 0) {
        cartItems.innerHTML = `<div class="empty-cart">${t('cartEmptyMsg')}</div>`;
    } else {
        cartItems.innerHTML = cart.map((item, index) => {
            const hasCustom = item.customPrice && item.customPrice !== item.originalPrice;
            const priceDisplay = hasCustom
                ? `Rs.${item.price.toFixed(2)} <span style="color:var(--warning);font-size:0.8em">(${t('custom')})</span>`
                : `Rs.${item.price.toFixed(2)}`;

            return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${escapeHtml(item.name)}</h4>
                    <p>${priceDisplay} ${t('each')}</p>
                </div>
                <div class="cart-item-controls">
                    <button class="btn-quantity" onclick="updateQuantityByIndex(${index}, -1)">−</button>
                    <span class="quantity" onclick="editQuantity(${index})" title="Click to edit">${escapeHtml(formatQuantity(item.quantity, item.unit || 'Kg'))}</span>
                    <button class="btn-quantity" onclick="updateQuantityByIndex(${index}, 1)">+</button>
                    <button class="btn-edit" onclick="editCartItemPrice(${index})" title="Change Price">✎</button>
                    <button class="btn-remove" onclick="removeFromCartByIndex(${index})">×</button>
                </div>
                <div class="cart-item-total">Rs.${(item.price * item.quantity).toFixed(2)}</div>
            </div>`;
        }).join('');
    }

    updateCartBadge();
    updateSummary();
}

function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = cart.length;
        badge.style.display = cart.length > 0 ? 'inline-flex' : 'none';
    }
}

function getDiscountAmount(subtotal) {
    const amountInput = document.getElementById('discountAmount');
    const typeInput = document.getElementById('discountType');
    const amount = parseFloat(amountInput?.value || 0) || 0;
    const type = typeInput?.value || 'flat';
    if (amount <= 0) return 0;
    if (type === 'percent') return Math.min(subtotal, subtotal * (amount / 100));
    return Math.min(subtotal, amount);
}

function updateSummary() {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = getDiscountAmount(subtotal);
    const total = subtotal - discount;

    if (subtotalEl) subtotalEl.textContent = `Rs.${subtotal.toFixed(2)}`;

    const discountRow = document.getElementById('discountRow');
    const discountDisplay = document.getElementById('discountDisplay');
    if (discountRow && discountDisplay) {
        if (discount > 0) {
            discountRow.style.display = 'flex';
            discountDisplay.textContent = `-Rs.${discount.toFixed(2)}`;
        } else {
            discountRow.style.display = 'none';
        }
    }

    if (totalEl) totalEl.textContent = `Rs.${total.toFixed(2)}`;
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm(t('clearCartConfirm'))) {
        cart = [];
        const discount = document.getElementById('discountAmount');
        if (discount) discount.value = '';
        const customer = document.getElementById('customerNameInput');
        if (customer) customer.value = '';
        const phone = document.getElementById('customerPhoneInput');
        if (phone) phone.value = '';
        const credit = document.getElementById('creditToggle');
        if (credit) credit.checked = false;
        updateCart();
        showNotification(t('cartCleared'), 'info');
    }
}

// ==================== CHECKOUT ====================
let selectedReceiptLanguage = 'english';
let pendingCheckoutData = null;

function showLanguageModal() {
    document.getElementById('languageModal').style.display = 'block';
}

function closeLanguageModal() {
    const m = document.getElementById('languageModal');
    if (m) m.style.display = 'none';
}

function selectLanguage(language) {
    selectedReceiptLanguage = language;
    closeLanguageModal();
    if (pendingCheckoutData) {
        finishCheckout(pendingCheckoutData);
        pendingCheckoutData = null;
    }
}

function checkout() {
    if (cart.length === 0) { showNotification(t('cartEmpty'), 'error'); return; }

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const discount = getDiscountAmount(subtotal);
    const total = subtotal - discount;
    const customerName = (document.getElementById('customerNameInput')?.value || '').trim();
    const customerPhone = (document.getElementById('customerPhoneInput')?.value || '').trim();
    const isCredit = document.getElementById('creditToggle')?.checked || false;

    selectedReceiptLanguage = settings.language === 'urdu' ? 'urdu' : 'english';
    finishCheckout({
        cartSnapshot: [...cart.map(i => ({ ...i }))],
        subtotal,
        discount,
        total,
        customerName,
        customerPhone,
        isCredit
    });
}

async function finishCheckout(data) {
    const receipt = generateReceipt(selectedReceiptLanguage, data);

    // Save transaction
    const tx = {
        id: Date.now(),
        date: new Date().toISOString(),
        items: data.cartSnapshot,
        subtotal: data.subtotal,
        discount: data.discount,
        total: data.total,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        isCredit: data.isCredit,
        language: selectedReceiptLanguage
    };

    // Decrement stock
    decrementStockForCart(data.cartSnapshot);
    // Refresh product display to show updated stock
    displayProducts(getFilteredProducts());

    // Save customer if provided
    if (data.customerName) await ensureCustomer(data.customerName, data.customerPhone);

    // Persist transaction
    await persistTransaction(tx);

    // Print receipt
    const win = window.open('', '_blank');
    win.document.write(receipt);
    win.document.close();
    win.print();

    // Clear cart
    cart = [];
    const discount = document.getElementById('discountAmount');
    if (discount) discount.value = '';
    const customerName = document.getElementById('customerNameInput');
    if (customerName) customerName.value = '';
    const customerPhone = document.getElementById('customerPhoneInput');
    if (customerPhone) customerPhone.value = '';
    const creditToggle = document.getElementById('creditToggle');
    if (creditToggle) creditToggle.checked = false;

    updateCart();
    showNotification(t('checkoutComplete', {
        total: data.total.toFixed(2),
        credit: data.isCredit ? t('creditSuffix') : ''
    }), 'success');
}

// ==================== RECEIPT ====================
function generateReceipt(language = 'english', data = null) {
    const cartData = data ? data.cartSnapshot : cart;
    const subtotal = data ? data.subtotal : cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const discount = data ? data.discount : 0;
    const total = data ? data.total : subtotal;
    const customerName = data?.customerName || '';
    const isCredit = data?.isCredit || false;
    const date = new Date().toLocaleString();

    const t = language === 'urdu' ? {
        storeName: settings.storeName,
        receipt: 'رسید', date: 'تاریخ', customer: 'گاہک',
        item: 'آئٹم', quantity: 'مقدار', price: 'قیمت', total: 'کل',
        subtotal: 'ذیلی کل', discount: 'رعایت', thankYou: 'آپ کی خریداری کا شکریہ!',
        credit: 'ادھار (خاتہ)'
    } : {
        storeName: settings.storeName,
        receipt: 'Receipt', date: 'Date', customer: 'Customer',
        item: 'Item', quantity: 'Quantity', price: 'Price', total: 'Total',
        subtotal: 'Subtotal', discount: 'Discount', thankYou: 'Thank you for your purchase!',
        credit: 'Credit (Khata)'
    };

    const isUrdu = language === 'urdu';
    const dir = isUrdu ? 'rtl' : 'ltr';
    const font = isUrdu ? 'Arial, "Noto Nastaliq Urdu", sans-serif' : 'Arial, sans-serif';

    return `<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(t.receipt)}</title>
<style>
  body { font-family: ${font}; padding: 20px; direction: ${dir}; max-width: 600px; margin: 0 auto; }
  h1 { text-align: center; font-size: 24px; margin-bottom: 4px; }
  .store-sub { text-align: center; color: #666; font-size: 13px; margin-bottom: 16px; }
  .meta { font-size: 13px; margin-bottom: 16px; }
  .meta p { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 8px; text-align: ${isUrdu ? 'right' : 'left'}; border-bottom: 1px solid #ddd; font-size: 13px; }
  th { background: #f2f2f2; font-weight: bold; }
  .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid #333; }
  .credit-badge { background: #ff9800; color: white; padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: bold; }
  .footer { text-align: center; margin-top: 24px; color: #555; font-size: 13px; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
  <h1>${escapeHtml(t.storeName)}</h1>
  ${settings.storeAddress ? `<div class="store-sub">${escapeHtml(settings.storeAddress)}</div>` : ''}
  ${settings.storePhone ? `<div class="store-sub">${escapeHtml(settings.storePhone)}</div>` : ''}
  <div class="meta">
    <p><strong>${t.date}:</strong> ${date}</p>
    ${customerName ? `<p><strong>${t.customer}:</strong> ${escapeHtml(customerName)}</p>` : ''}
    ${isCredit ? `<p><span class="credit-badge">${t.credit}</span></p>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>${t.item}</th>
        <th>${t.quantity}</th>
        <th>${t.price}</th>
        <th>${t.total}</th>
      </tr>
    </thead>
    <tbody>
      ${cartData.map(item => {
        const name = escapeHtml(isUrdu && item.nameUrdu ? item.nameUrdu : item.name);
        const qty = escapeHtml(formatQuantity(item.quantity, item.unit || 'Kg'));
        return `<tr>
          <td>${name}</td>
          <td>${qty}</td>
          <td>Rs.${item.price.toFixed(2)}</td>
          <td>Rs.${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      ${discount > 0 ? `<tr><td colspan="3" style="text-align:${isUrdu ? 'left' : 'right'}">${t.subtotal}:</td><td>Rs.${subtotal.toFixed(2)}</td></tr>
      <tr><td colspan="3" style="text-align:${isUrdu ? 'left' : 'right'};color:green">${t.discount}:</td><td style="color:green">-Rs.${discount.toFixed(2)}</td></tr>` : ''}
      <tr class="total-row">
        <td colspan="3" style="text-align:${isUrdu ? 'left' : 'right'}">${t.total}:</td>
        <td>Rs.${total.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">${t.thankYou}</div>
</body>
</html>`;
}

// ==================== REPORTS ====================
function renderReports() {
    const filter = document.getElementById('reportFilter')?.value || 'all';
    const now = new Date();

    const filtered = transactions.filter(tx => {
        const d = new Date(tx.date);
        if (filter === 'today') return d.toDateString() === now.toDateString();
        if (filter === 'week') {
            const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
            return d >= weekStart;
        }
        if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        return true;
    });

    // Today stats (always today)
    const today = transactions.filter(tx => new Date(tx.date).toDateString() === now.toDateString());
    const todayRevenue = today.filter(t => !t.isCredit).reduce((s, t) => s + t.total, 0);
    const todayCredit = today.filter(t => t.isCredit).reduce((s, t) => s + t.total, 0);
    const todayCount = today.filter(t => !t.isCredit).length;
    const todayCreditCount = today.filter(t => t.isCredit).length;

    // All-time
    const allRevenue = transactions.filter(t => !t.isCredit).reduce((s, t) => s + t.total, 0);
    const outstanding = transactions.filter(t => t.isCredit).reduce((s, t) => s + t.total, 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('todayRevenue', `Rs.${todayRevenue.toFixed(2)}`);
    set('todayCount', `${todayCount} sale${todayCount !== 1 ? 's' : ''}`);
    set('todayCredit', `Rs.${todayCredit.toFixed(2)}`);
    set('todayCreditCount', `${todayCreditCount} credit sale${todayCreditCount !== 1 ? 's' : ''}`);
    set('allTimeRevenue', `Rs.${allRevenue.toFixed(2)}`);
    set('allTimeCount', `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`);
    set('outstandingKhata', `Rs.${outstanding.toFixed(2)}`);

    // Transaction table
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">${t('noTransactionsFound')}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((tx, i) => {
        const date = new Date(tx.date).toLocaleString();
        const itemSummary = tx.items.slice(0, 2).map(item => `${escapeHtml(item.name)} ×${formatQuantity(item.quantity, item.unit || 'Kg')}`).join(', ');
        const moreItems = tx.items.length > 2 ? ` +${tx.items.length - 2} more` : '';
        const realIndex = transactions.indexOf(tx);

        return `<tr>
            <td>${date}</td>
            <td>${escapeHtml(tx.customerName || '—')}</td>
            <td>
                ${itemSummary}${moreItems}
                <div class="transaction-items-list">${tx.items.length} item${tx.items.length !== 1 ? 's' : ''}</div>
            </td>
            <td>${tx.discount > 0 ? `-Rs.${tx.discount.toFixed(2)}` : '—'}</td>
            <td><strong>Rs.${tx.total.toFixed(2)}</strong></td>
            <td>${tx.isCredit ? `<span class="badge-credit">${t('badgeKhata')}</span>` : `<span class="badge-cash">${t('badgeCash')}</span>`}</td>
            <td class="transaction-actions">
                <button class="btn-reprint" onclick="viewTransaction(${realIndex})">${t('view')}</button>
            </td>
        </tr>`;
    }).join('');
}

function viewTransaction(txIndex) {
    const tx = transactions[txIndex];
    if (!tx) return;
    viewingTransactionIndex = txIndex;

    const body = document.getElementById('receiptDetailBody');
    if (!body) return;

    const date = new Date(tx.date).toLocaleString();
    body.innerHTML = `
        <p><strong>Date:</strong> ${date}</p>
        ${tx.customerName ? `<p><strong>Customer:</strong> ${escapeHtml(tx.customerName)}${tx.customerPhone ? ` (${escapeHtml(tx.customerPhone)})` : ''}</p>` : ''}
        <p><strong>Type:</strong> ${tx.isCredit ? '<span class="badge-credit">Khata / Credit</span>' : '<span class="badge-cash">Cash</span>'}</p>
        <table class="receipt-detail-table">
            <thead>
                <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
                ${tx.items.map(item => `<tr>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(formatQuantity(item.quantity, item.unit || 'Kg'))}</td>
                    <td>Rs.${item.price.toFixed(2)}</td>
                    <td>Rs.${(item.price * item.quantity).toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
                ${tx.discount > 0 ? `
                <tr><td colspan="3"><strong>Subtotal</strong></td><td>Rs.${tx.subtotal.toFixed(2)}</td></tr>
                <tr><td colspan="3" style="color:green"><strong>Discount</strong></td><td style="color:green">-Rs.${tx.discount.toFixed(2)}</td></tr>` : ''}
                <tr><td colspan="3"><strong>Total</strong></td><td><strong>Rs.${tx.total.toFixed(2)}</strong></td></tr>
            </tfoot>
        </table>`;

    document.getElementById('receiptDetailModal').style.display = 'block';
}

function closeReceiptDetailModal() {
    const m = document.getElementById('receiptDetailModal');
    if (m) m.style.display = 'none';
    viewingTransactionIndex = null;
}

function reprintReceipt() {
    if (viewingTransactionIndex === null) return;
    const tx = transactions[viewingTransactionIndex];
    if (!tx) return;
    const receipt = generateReceipt(tx.language || 'english', tx);
    const win = window.open('', '_blank');
    win.document.write(receipt);
    win.document.close();
    win.print();
}

// Report filter change
document.addEventListener('DOMContentLoaded', () => {
    // reportFilter listener added after DOM ready
    setTimeout(() => {
        const rf = document.getElementById('reportFilter');
        if (rf) rf.addEventListener('change', renderReports);
    }, 0);
});

// ==================== EXPORT TO EXCEL ====================
function exportTransactionsToExcel() {
    if (transactions.length === 0) {
        showNotification('No transactions to export', 'error');
        return;
    }

    const rows = [];
    transactions.forEach(tx => {
        tx.items.forEach(item => {
            rows.push({
                'Date': new Date(tx.date).toLocaleString(),
                'Transaction ID': tx.id,
                'Customer': tx.customerName || '',
                'Phone': tx.customerPhone || '',
                'Item': item.name,
                'Item (Urdu)': item.nameUrdu || '',
                'Quantity': formatQuantity(item.quantity, item.unit || 'Kg'),
                'Unit Price (Rs)': item.price.toFixed(2),
                'Item Total (Rs)': (item.price * item.quantity).toFixed(2),
                'Subtotal (Rs)': tx.subtotal.toFixed(2),
                'Discount (Rs)': (tx.discount || 0).toFixed(2),
                'Total (Rs)': tx.total.toFixed(2),
                'Type': tx.isCredit ? 'Khata/Credit' : 'Cash'
            });
        });
    });

    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

        // Export via blob download (works in Electron)
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pos_transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('Exported to Excel successfully!', 'success');
    } catch (err) {
        showNotification('Export failed: ' + err.message, 'error');
    }
}

// ==================== NOTIFICATIONS ====================
function showNotification(message, type = 'info') {
    if (!notification) return;
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    setTimeout(() => notification.classList.remove('show'), 3500);
}

// ==================== GLOBAL EXPORTS ====================
window.addToCart = addToCart;
window.selectPrice = selectPrice;
window.closePriceModal = closePriceModal;
window.confirmPriceSelection = confirmPriceSelection;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.updateQuantityByIndex = updateQuantityByIndex;
window.removeFromCartByIndex = removeFromCartByIndex;
window.editCartItemPrice = editCartItemPrice;
window.editQuantity = editQuantity;
window.closeQuantityModal = closeQuantityModal;
window.confirmQuantitySelection = confirmQuantitySelection;
window.selectLanguage = selectLanguage;
window.closeLanguageModal = closeLanguageModal;
window.saveSettingsFromForm = saveSettingsFromForm;
window.resetStockOverrides = resetStockOverrides;
window.exportTransactionsToExcel = exportTransactionsToExcel;
window.viewTransaction = viewTransaction;
window.closeReceiptDetailModal = closeReceiptDetailModal;
window.reprintReceipt = reprintReceipt;
