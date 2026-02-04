// Use modules exposed via preload script
if (!window.electronAPI) {
    console.error('electronAPI not available! Check preload script.');
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Error</h1><p>Failed to load required modules. Please restart the application.</p><p style="color: #666; font-size: 12px;">If the problem persists, run: npm install</p></div>';
}

if (window.electronAPI && window.electronAPI.error) {
    console.error('Preload error:', window.electronAPI.error);
    document.body.innerHTML = `<div style="padding: 20px; text-align: center;"><h1>Module Loading Error</h1><p>${window.electronAPI.error}</p><p style="color: #666; font-size: 12px;">Please run: npm install</p></div>`;
}

const axios = window.electronAPI?.axios;
const XLSX = window.electronAPI?.XLSX;

if (!axios || !XLSX) {
    console.error('Modules not loaded:', { axios: !!axios, XLSX: !!XLSX });
    console.error('electronAPI contents:', Object.keys(window.electronAPI || {}));
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Error</h1><p>Required modules (axios, XLSX) not loaded.</p><p style="color: #666; font-size: 12px;">Please run: npm install</p></div>';
}

// Verify axios has the get method
if (axios && typeof axios.get !== 'function') {
    console.error('axios.get is not a function!');
    console.error('axios type:', typeof axios);
    console.error('axios keys:', Object.keys(axios || {}));
    console.error('axios.get:', axios.get);
    console.error('Full axios object:', axios);
}

let products = [];
let cart = [];
let excelUrl = '';

// Default Excel URL - Google Sheets
const DEFAULT_EXCEL_URL = 'https://docs.google.com/spreadsheets/d/1n4Qvos_RZLgex2pxisiJGYjgneDbmujRkJuRE-W0bEM/';

// DOM Elements (will be initialized in DOMContentLoaded)
let productsGrid, cartItems, searchInput, loadBtn, refreshBtn, excelUrlInput;
let fileInput, fileBtn, clearCartBtn, checkoutBtn;
let subtotalEl, taxEl, totalEl, notification;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get all DOM elements
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
    subtotalEl = document.getElementById('subtotal');
    taxEl = document.getElementById('tax');
    totalEl = document.getElementById('total');
    notification = document.getElementById('notification');
    
    // Verify all critical elements exist
    if (!productsGrid || !excelUrlInput || !fileInput || !fileBtn) {
        console.error('Required DOM elements not found!', {
            productsGrid: !!productsGrid,
            excelUrlInput: !!excelUrlInput,
            fileInput: !!fileInput,
            fileBtn: !!fileBtn
        });
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="error">Error: Required elements not found. Please refresh the page.</div>';
        }
        return;
    }
    
    console.log('All DOM elements loaded successfully');
    
    // Clear old OneDrive URL from localStorage and use Google Sheets
    const storedUrl = localStorage.getItem('excelUrl');
    // If stored URL is OneDrive, use default Google Sheets URL instead
    if (storedUrl && (storedUrl.includes('onedrive') || storedUrl.includes('excel.cloud.microsoft'))) {
        console.log('[Init] Clearing old OneDrive URL from storage');
        localStorage.removeItem('excelUrl');
        excelUrlInput.value = DEFAULT_EXCEL_URL;
    } else {
        excelUrlInput.value = storedUrl || DEFAULT_EXCEL_URL;
    }
    excelUrl = excelUrlInput.value;
    console.log('[Init] Using URL:', excelUrl);
    
    // Set up event listeners
    if (loadBtn) loadBtn.addEventListener('click', loadExcel);
    if (refreshBtn) refreshBtn.addEventListener('click', loadExcel);
    
    // File picker button
    if (fileBtn && fileInput) {
        fileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('File button clicked, opening file picker...');
            try {
                fileInput.click();
            } catch (error) {
                console.error('Error opening file picker:', error);
                showNotification('Error opening file picker: ' + error.message, 'error');
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            console.log('File selected:', e.target.files[0]?.name);
            handleFileSelect(e);
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
        searchInput.addEventListener('keyup', filterProducts); // Also trigger on keyup for better responsiveness
        console.log('Search input event listener attached');
    } else {
        console.error('searchInput element not found!');
    }
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);
    
    // Auto-load Excel file on startup
    loadExcel();
});

// Handle local file selection
function handleFileSelect(event) {
    console.log('handleFileSelect called', event);
    const file = event.target.files[0];
    
    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        showNotification('Please select a valid Excel file (.xlsx or .xls)', 'error');
        productsGrid.innerHTML = '<div class="error">Invalid file type. Please select an Excel file (.xlsx or .xls)</div>';
        return;
    }

    showNotification('Loading products from file...', 'info');
    productsGrid.innerHTML = '<div class="loading">Loading products from file...<br><small>Reading ' + file.name + '</small></div>';

    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            console.log('File read successfully, size:', e.target.result.byteLength);
            const data = new Uint8Array(e.target.result);
            console.log('Processing Excel data...');
            processExcelData(data);
        } catch (error) {
            console.error('Error reading file:', error);
            showNotification('Error reading file: ' + error.message, 'error');
            productsGrid.innerHTML = `<div class="error">
                <p><strong>Failed to read file</strong></p>
                <p style="font-size: 12px; margin-top: 10px;">${error.message}</p>
            </div>`;
        }
    };
    
    reader.onerror = function(error) {
        console.error('FileReader error:', error);
        showNotification('Error reading file', 'error');
        productsGrid.innerHTML = '<div class="error">Failed to read file. Please try selecting the file again.</div>';
    };
    
    reader.onprogress = function(e) {
        if (e.lengthComputable) {
            const percentLoaded = Math.round((e.loaded / e.total) * 100);
            console.log('File reading progress:', percentLoaded + '%');
        }
    };
    
    try {
        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error('Error starting file read:', error);
        showNotification('Error reading file: ' + error.message, 'error');
        productsGrid.innerHTML = '<div class="error">Failed to read file. Please try again.</div>';
    }
}

// Process Excel data (shared between URL and file loading)
function processExcelData(arrayBuffer) {
    try {
        console.log('Starting Excel processing, buffer size:', arrayBuffer.length);
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Excel file contains no sheets');
        }

        const sheetName = workbook.SheetNames[0];
        console.log('Using sheet:', sheetName);
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON - try with header row detection
        let data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        // If no data, try without header detection
        if (data.length === 0) {
            console.log('No data with header detection, trying raw data...');
            data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            if (data.length > 1) {
                // First row is headers
                const headers = data[0];
                data = data.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index];
                    });
                    return obj;
                });
            }
        }
        
        console.log('Parsed data rows:', data.length);
        console.log('First 3 rows:', data.slice(0, 3));
        console.log('Available columns:', data.length > 0 ? Object.keys(data[0]) : 'No data');
        
        if (data.length === 0) {
            throw new Error('Excel file is empty or contains no data rows');
        }
        
        // Process products with more flexible column matching
        const rawProducts = data.map((row, index) => {
            // Try to find name column (case-insensitive, various formats)
            const nameKeys = Object.keys(row).filter(k => 
                /name|product|item|title/i.test(k)
            );
            const name = nameKeys.length > 0 ? row[nameKeys[0]] : 
                (row.Name || row.name || row.Product || row.product || 
                 row['Product Name'] || row['product name'] || 
                 row.Item || row.item || 'Unknown');
            
            // Try to find price column
            const priceKeys = Object.keys(row).filter(k => 
                /price|cost|amount|rate/i.test(k)
            );
            const price = priceKeys.length > 0 ? parseFloat(row[priceKeys[0]]) || 0 :
                parseFloat(row.Price || row.price || row.Cost || row.cost || 
                          row['Unit Price'] || row['unit price'] || 0);
            
            // Try to find stock column
            const stockKeys = Object.keys(row).filter(k => 
                /stock|quantity|qty|available|in.stock/i.test(k)
            );
            const stock = stockKeys.length > 0 ? parseInt(row[stockKeys[0]]) || 0 :
                parseInt(row.Stock || row.stock || row.Quantity || row.quantity || 
                        row['In Stock'] || row['in stock'] || 0);
            
            // Try to find category column
            const categoryKeys = Object.keys(row).filter(k => 
                /category|type|group|class/i.test(k)
            );
            const category = categoryKeys.length > 0 ? row[categoryKeys[0]] || 'General' :
                (row.Category || row.category || row['Product Category'] || 
                 row['product category'] || 'General');
            
            return {
                id: index + 1,
                name: String(name).trim(),
                price: price,
                stock: stock,
                category: String(category).trim(),
                barcode: row.Barcode || row.barcode || row.SKU || row.sku || 
                        row['Product Code'] || row['product code'] || '',
                description: row.Description || row.description || 
                            row['Product Description'] || row['product description'] || ''
            };
        });
        
        console.log('Raw products before filtering:', rawProducts.length);
        console.log('Sample product before filter:', rawProducts[0]);
        
        // Filter out invalid products
        products = rawProducts.filter(product => {
            const isValid = product.name !== 'Unknown' && 
                           product.name !== '' && 
                           product.price > 0;
            if (!isValid) {
                console.log('Filtered out product:', product);
            }
            return isValid;
        });

        console.log('Products after filtering:', products.length);
        console.log('Sample products:', products.slice(0, 3));

        if (products.length === 0) {
            const availableColumns = data.length > 0 ? Object.keys(data[0]).join(', ') : 'none';
            throw new Error(`No valid products found. Found ${data.length} rows but none had valid Name and Price. Available columns: ${availableColumns}`);
        }

        displayProducts(products);
        showNotification(`Loaded ${products.length} products successfully`, 'success');
    } catch (error) {
        console.error('Error processing Excel:', error);
        console.error('Error stack:', error.stack);
        showNotification('Error processing Excel file: ' + error.message, 'error');
        productsGrid.innerHTML = `<div class="error">
            <p><strong>Failed to process Excel file</strong></p>
            <p style="font-size: 12px; margin-top: 10px;">${error.message}</p>
            <p style="font-size: 11px; margin-top: 10px; color: #666;">Check the browser console (F12) for detailed column information.</p>
        </div>`;
    }
}

// Convert Google Drive/Sheets URL to direct download link
function convertGoogleDriveUrl(url) {
    // Check if it's a Google Sheets URL
    if (url.includes('docs.google.com/spreadsheets')) {
        // Extract sheet ID and GID from Google Sheets URL
        // Format variations:
        // - https://docs.google.com/spreadsheets/d/SHEET_ID/edit?gid=GID#gid=GID
        // - https://docs.google.com/spreadsheets/d/SHEET_ID/
        // - https://docs.google.com/spreadsheets/d/SHEET_ID/edit
        const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        
        if (sheetIdMatch) {
            const sheetId = sheetIdMatch[1];
            // Try to extract GID from URL (can be in query string or hash)
            const gidMatch = url.match(/[?&#]gid=(\d+)/);
            
            // If GID is specified, use it; otherwise try without gid parameter first
            // Some sheets work better without gid, others need gid=0
            if (gidMatch) {
                const gid = gidMatch[1];
                const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gid}`;
                console.log('[URL Conversion] Google Sheets URL converted (with GID):', { 
                    original: url, 
                    sheetId: sheetId,
                    gid: gid,
                    converted: exportUrl 
                });
                return exportUrl;
            } else {
                // No GID specified - try without gid parameter (exports entire workbook)
                // This often works better for the first/default sheet
                const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
                console.log('[URL Conversion] Google Sheets URL converted (no GID):', { 
                    original: url, 
                    sheetId: sheetId,
                    converted: exportUrl 
                });
                return exportUrl;
            }
        } else {
            console.error('[URL Conversion] Could not extract sheet ID from URL:', url);
            return url; // Return original if we can't parse it
        }
    }
    
    // Check if it's a Google Drive URL (for regular files)
    if (url.includes('drive.google.com')) {
        // Extract file ID from various Google Drive URL formats
        let fileId = '';
        
        // Format: https://drive.google.com/file/d/FILE_ID/view
        const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match1) {
            fileId = match1[1];
        }
        
        // Format: https://drive.google.com/open?id=FILE_ID
        const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match2) {
            fileId = match2[1];
        }
        
        if (fileId) {
            // Convert to direct download URL
            return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
    }
    
    // Check if it's a Dropbox URL
    if (url.includes('dropbox.com')) {
        // Convert Dropbox share link to direct download
        return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').split('?')[0];
    }
    
    // Check if it's a OneDrive/Microsoft 365 URL
    if (url.includes('onedrive.live.com') || url.includes('1drv.ms') || url.includes('excel.cloud.microsoft') || url.includes('sharepoint.com')) {
        return convertOneDriveUrl(url);
    }
    
    return url;
}

// Convert OneDrive/Microsoft 365 URL to direct download link
function convertOneDriveUrl(url) {
    try {
        // Handle excel.cloud.microsoft format
        // Format: https://excel.cloud.microsoft/open/onedrive/?docId=DRIVE_ID!ITEM_ID&driveId=DRIVE_ID
        if (url.includes('excel.cloud.microsoft')) {
            const urlObj = new URL(url);
            const docId = urlObj.searchParams.get('docId');
            const driveId = urlObj.searchParams.get('driveId');
            
            if (docId && driveId) {
                // docId format is usually "DRIVE_ID!ITEM_ID"
                const parts = docId.split('!');
                const itemId = parts.length > 1 ? parts[1] : parts[0];
                
                // Try multiple methods for OneDrive access
                // Method 1: Try Graph API (requires auth, but might work for public files)
                const graphUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;
                
                // Method 2: Try using the sharing API endpoint (for public files)
                // This format might work for publicly shared files
                const sharingUrl = `https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(`u!${btoa(`https://onedrive.live.com/redir?resid=${driveId}!${itemId}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`)}/driveItem/content`;
                
                // Return Graph API URL first, we'll fallback if needed
                // Note: Both methods may require the file to be publicly shared
                return graphUrl;
            }
        }
        
        // Handle onedrive.live.com format
        if (url.includes('onedrive.live.com')) {
            // Extract resource ID from URL
            const match = url.match(/resid=([^&]+)/);
            if (match) {
                const resid = decodeURIComponent(match[1]);
                return `https://onedrive.live.com/download?resid=${encodeURIComponent(resid)}`;
            }
        }
        
        // Handle 1drv.ms short links
        if (url.includes('1drv.ms')) {
            // Short links need to be expanded first, but we'll try the direct format
            return url.replace('1drv.ms', 'onedrive.live.com');
        }
        
        // Handle SharePoint URLs
        if (url.includes('sharepoint.com')) {
            // Try to convert SharePoint sharing link to direct download
            if (url.includes('/:x:/') || url.includes('/:w:/')) {
                // Convert sharing link to download format
                let downloadUrl = url;
                if (url.includes('/:x:/')) {
                    downloadUrl = url.replace('/:x:/', '/:x:/r/');
                } else if (url.includes('/:w:/')) {
                    downloadUrl = url.replace('/:w:/', '/:w:/r/');
                }
                // Add download parameter
                downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + 'download=1';
                return downloadUrl;
            }
        }
        
        return url;
    } catch (error) {
        console.error('Error converting OneDrive URL:', error);
        return url;
    }
}

// Load Excel file from URL with fallback methods
async function loadExcel() {
    const url = excelUrlInput.value.trim();
    if (!url) {
        showNotification('Please enter an Excel file URL', 'error');
        return;
    }

    excelUrl = url;
    localStorage.setItem('excelUrl', url);
    
    showNotification('Loading products...', 'info');
    const isGoogleSheets = url.includes('docs.google.com/spreadsheets');
    const loadingMsg = isGoogleSheets ? 
        'Loading products from Google Sheets...<br><small>This may take a moment...</small>' :
        'Loading products...<br><small>This may take a moment...</small>';
    productsGrid.innerHTML = `<div class="loading">${loadingMsg}</div>`;
    
    // Update loading message after a delay
    const loadingTimeout = setTimeout(() => {
        productsGrid.innerHTML = '<div class="loading">Still loading...<br><small>If this takes too long, try downloading the file and using "Choose Local File"</small></div>';
    }, 5000);
    
    try {
        // Check URL type - prioritize Google Sheets
        const isGoogleSheets = url.includes('docs.google.com/spreadsheets');
        // Only check for OneDrive if it's NOT Google Sheets (to avoid false positives)
        const isOneDrive = !isGoogleSheets && (url.includes('onedrive') || url.includes('excel.cloud.microsoft') || url.includes('sharepoint'));
        
        console.log('[loadExcel] URL type detection:', { url, isGoogleSheets, isOneDrive });
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout after 30 seconds. The file may require authentication or be inaccessible.')), 30000);
        });
        
        // For OneDrive, try multiple methods
        if (isOneDrive) {
            console.log('[loadExcel] Using OneDrive methods');
            await Promise.race([tryOneDriveMethods(url), timeoutPromise]);
        } else {
            // Google Sheets and other URLs use single method
            console.log('[loadExcel] Using single method (Google Sheets or other)');
            await Promise.race([trySingleMethod(url), timeoutPromise]);
        }
        
        clearTimeout(loadingTimeout);
    } catch (error) {
        clearTimeout(loadingTimeout);
        console.error('Error in loadExcel:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.status,
            request: error.request ? 'Request made but no response' : 'No request made'
        });
        
        let errorMsg = 'Failed to load Excel file. ';
        
        if (error.message.includes('timeout')) {
            errorMsg += 'Request timed out. The file may require authentication or be inaccessible.';
        } else if (error.message.includes('Authentication')) {
            errorMsg += 'OneDrive file requires authentication. Please download the file and use "Choose Local File" instead.';
        } else if (error.message) {
            errorMsg += error.message;
        } else {
            errorMsg += 'Unknown error occurred.';
        }
        
        showNotification(errorMsg, 'error');
        productsGrid.innerHTML = `<div class="error">
            <p><strong>Failed to load products</strong></p>
            <p style="font-size: 14px; margin-top: 10px; color: #dc3545;">${errorMsg}</p>
            <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
                <p style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Solutions:</p>
                <ol style="font-size: 12px; margin-left: 20px; line-height: 1.8;">
                    <li>Download the Excel file from OneDrive</li>
                    <li>Click "Choose Local File" button above</li>
                    <li>Select the downloaded file</li>
                </ol>
            </div>
            <p style="font-size: 11px; margin-top: 15px; color: #666;">Check the browser console (Press F12) for technical details.</p>
        </div>`;
    }
}

// Try loading from OneDrive using multiple methods
async function tryOneDriveMethods(url) {
    const methods = [];
    
    // Method 1: Graph API
    const downloadUrl1 = convertGoogleDriveUrl(url);
    methods.push({ url: downloadUrl1, name: 'Graph API' });
    
    // Method 2: Try alternative format
    if (url.includes('excel.cloud.microsoft')) {
        const urlObj = new URL(url);
        const docId = urlObj.searchParams.get('docId');
        const driveId = urlObj.searchParams.get('driveId');
        if (docId && driveId) {
            const parts = docId.split('!');
            const itemId = parts.length > 1 ? parts[1] : parts[0];
            // Try alternative endpoint
            const altUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content?download=true`;
            methods.push({ url: altUrl, name: 'Graph API (download)' });
        }
    }
    
    console.log(`Trying ${methods.length} methods for OneDrive file...`);
    
    // Try each method
    for (let i = 0; i < methods.length; i++) {
        const method = methods[i];
        try {
            console.log(`[${i + 1}/${methods.length}] Trying ${method.name}:`, method.url);
            
            const response = await axios.get(method.url, {
                responseType: 'arraybuffer',
                timeout: 10000, // Reduced timeout to fail faster
                headers: {
                    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, */*'
                },
                validateStatus: function (status) {
                    return status < 500; // Don't throw for 4xx errors, we'll handle them
                }
            });

            console.log(`${method.name} response status:`, response.status);

            if (response.status === 200 && response.data && response.data.length > 0) {
                console.log(`✓ Success with ${method.name}! File size:`, response.data.length, 'bytes');
                processExcelData(response.data);
                return; // Success!
            } else if (response.status === 401 || response.status === 403) {
                console.log(`✗ ${method.name} failed: Authentication required (${response.status})`);
                // OneDrive requires authentication - show helpful message
                if (i === methods.length - 1) {
                    throw new Error('OneDrive file requires authentication. Please download the file and use "Choose Local File" button instead.');
                }
                continue; // Try next method
            } else {
                console.log(`✗ ${method.name} failed: Status ${response.status}`);
                if (i === methods.length - 1) {
                    throw new Error(`All methods failed: HTTP ${response.status}`);
                }
                continue;
            }
        } catch (error) {
            console.log(`✗ ${method.name} failed:`, error.message);
            if (i === methods.length - 1) {
                // Last method failed, throw error
                throw error;
            }
            continue; // Try next method
        }
    }
    
    // Should not reach here, but just in case
    throw new Error('All methods failed');
}

// Try loading from a single URL
async function trySingleMethod(url) {
    try {
        const downloadUrl = convertGoogleDriveUrl(url);
        console.log('Original URL:', url);
        console.log('Converted download URL:', downloadUrl);
        
        const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, */*'
            },
            maxRedirects: 5  // Allow redirects for Google Sheets
        });

        if (!response.data || response.data.length === 0) {
            throw new Error('Empty response from server');
        }

        console.log('File downloaded successfully, size:', response.data.length, 'bytes');
        processExcelData(response.data);
    } catch (error) {
        console.error('Error loading Excel:', error);
        console.error('Error response status:', error.response?.status);
        
        // Check if it's a Google Sheets access error
        if (url.includes('docs.google.com/spreadsheets')) {
            if (error.response && (error.response.status === 403 || error.response.status === 401)) {
                showNotification('Google Sheets file is not publicly accessible', 'error');
                productsGrid.innerHTML = `<div class="error">
                    <p><strong>Google Sheets Access Denied</strong></p>
                    <p style="font-size: 14px; margin-top: 10px;">The Google Sheet needs to be publicly accessible.</p>
                    <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                        <p style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">To fix this:</p>
                        <ol style="font-size: 12px; margin-left: 20px; line-height: 2;">
                            <li>Open your Google Sheet</li>
                            <li>Click <strong>"Share"</strong> button (top right)</li>
                            <li>Change access to <strong>"Anyone with the link"</strong> → <strong>"Viewer"</strong></li>
                            <li>Click "Done"</li>
                            <li>Click "Refresh Products" button above</li>
                        </ol>
                    </div>
                </div>`;
                return;
            }
        }
        
        showGenericError(url, error);
    }
}


// Show generic error message
function showGenericError(url, error) {
    let errorMessage = 'Error loading Excel file. ';
    
    if (error.response) {
        if (error.response.status === 404) {
            errorMessage += 'File not found (404). Please check the URL.';
        } else if (error.response.status === 403) {
            errorMessage += 'Access denied (403). The file may be private. Make sure the file is publicly accessible.';
        } else if (error.response.status === 0) {
            errorMessage += 'CORS error. The file server does not allow cross-origin requests.';
        } else {
            errorMessage += `HTTP ${error.response.status}: ${error.response.statusText}`;
        }
    } else if (error.request) {
        errorMessage += 'No response from server. Check your internet connection and the file URL.';
    } else if (error.message) {
        errorMessage += error.message;
    } else {
        errorMessage += 'Unknown error occurred. Please check the console for details.';
    }
    
    showNotification(errorMessage, 'error');
    productsGrid.innerHTML = `<div class="error">
        <p><strong>Failed to load products</strong></p>
        <p style="font-size: 12px; margin-top: 10px;">${errorMessage}</p>
        <p style="font-size: 12px; margin-top: 10px;">Check the browser console (F12) for more details.</p>
    </div>`;
}

// Display products
function displayProducts(productsToShow) {
    console.log('displayProducts called with', productsToShow.length, 'products');
    
    if (!productsGrid) {
        console.error('productsGrid element not found!');
        return;
    }
    
    if (!productsToShow || productsToShow.length === 0) {
        console.log('No products to display');
        productsGrid.innerHTML = '<div class="empty">No products found</div>';
        return;
    }

    console.log('Rendering products:', productsToShow.slice(0, 3));
    
    try {
        const html = productsToShow.map(product => {
            if (!product.name || !product.price) {
                console.warn('Invalid product:', product);
                return '';
            }
            return `
                <div class="product-card" data-id="${product.id}">
                    <div class="product-info">
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-category">${product.category}</p>
                        <div class="product-details">
                            <span class="product-price">$${product.price.toFixed(2)}</span>
                            <span class="product-stock">Stock: ${product.stock}</span>
                        </div>
                    </div>
                    <button class="btn btn-add" onclick="addToCart(${product.id})" ${product.stock === 0 ? 'disabled' : ''}>
                        ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                </div>
            `;
        }).filter(html => html !== '').join('');
        
        productsGrid.innerHTML = html;
        console.log('Products displayed successfully');
    } catch (error) {
        console.error('Error displaying products:', error);
        productsGrid.innerHTML = `<div class="error">
            <p><strong>Error displaying products</strong></p>
            <p style="font-size: 12px; margin-top: 10px;">${error.message}</p>
        </div>`;
    }
}

// Filter products
function filterProducts() {
    if (!searchInput) {
        console.error('searchInput not found');
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    console.log('Searching for:', searchTerm, 'in', products.length, 'products');
    
    if (!searchTerm) {
        // If search is empty, show all products
        displayProducts(products);
        return;
    }
    
    const filtered = products.filter(product => {
        // Convert all values to strings for safe comparison
        const name = String(product.name || '').toLowerCase();
        const category = String(product.category || '').toLowerCase();
        const barcode = String(product.barcode || '').toLowerCase();
        
        const nameMatch = name.includes(searchTerm);
        const categoryMatch = category.includes(searchTerm);
        const barcodeMatch = barcode.includes(searchTerm);
        
        return nameMatch || categoryMatch || barcodeMatch;
    });
    
    console.log('Filtered products:', filtered.length);
    displayProducts(filtered);
}

// Add to cart
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock === 0) {
        showNotification('Product is out of stock', 'error');
        return;
    }

    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        if (cartItem.quantity >= product.stock) {
            showNotification('Not enough stock available', 'error');
            return;
        }
        cartItem.quantity++;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }

    updateCart();
    showNotification(`${product.name} added to cart`, 'success');
}

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

// Update quantity
function updateQuantity(productId, change) {
    const cartItem = cart.find(item => item.id === productId);
    if (!cartItem) return;

    const product = products.find(p => p.id === productId);
    const newQuantity = cartItem.quantity + change;

    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }

    if (newQuantity > product.stock) {
        showNotification('Not enough stock available', 'error');
        return;
    }

    cartItem.quantity = newQuantity;
    updateCart();
}

// Update cart display
function updateCart() {
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart">Cart is empty</div>';
        updateSummary();
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>$${item.price.toFixed(2)} each</p>
            </div>
            <div class="cart-item-controls">
                <button class="btn-quantity" onclick="updateQuantity(${item.id}, -1)">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="btn-quantity" onclick="updateQuantity(${item.id}, 1)">+</button>
                <button class="btn-remove" onclick="removeFromCart(${item.id})">×</button>
            </div>
            <div class="cart-item-total">
                $${(item.price * item.quantity).toFixed(2)}
            </div>
        </div>
    `).join('');

    updateSummary();
}

// Update summary
function updateSummary() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.10; // 10% tax
    const total = subtotal + tax;

    subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    taxEl.textContent = `$${tax.toFixed(2)}`;
    totalEl.textContent = `$${total.toFixed(2)}`;
}

// Clear cart
function clearCart() {
    if (cart.length === 0) return;
    
    if (confirm('Are you sure you want to clear the cart?')) {
        cart = [];
        updateCart();
        showNotification('Cart cleared', 'info');
    }
}

// Checkout
function checkout() {
    if (cart.length === 0) {
        showNotification('Cart is empty', 'error');
        return;
    }

    const total = parseFloat(totalEl.textContent.replace('$', ''));
    const receipt = generateReceipt();
    
    // Show receipt in a new window or print
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(receipt);
    receiptWindow.document.close();
    receiptWindow.print();

    // Clear cart after checkout
    cart = [];
    updateCart();
    showNotification('Checkout completed successfully!', 'success');
}

// Generate receipt
function generateReceipt() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.10;
    const total = subtotal + tax;
    const date = new Date().toLocaleString();

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f2f2f2; }
                .total { font-weight: bold; font-size: 1.2em; }
                .right { text-align: right; }
            </style>
        </head>
        <body>
            <h1>Receipt</h1>
            <p><strong>Date:</strong> ${date}</p>
            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${cart.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>$${item.price.toFixed(2)}</td>
                            <td>$${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" class="right">Subtotal:</td>
                        <td>$${subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td colspan="3" class="right">Tax (10%):</td>
                        <td>$${tax.toFixed(2)}</td>
                    </tr>
                    <tr class="total">
                        <td colspan="3" class="right">Total:</td>
                        <td>$${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            <p style="text-align: center; margin-top: 30px;">Thank you for your purchase!</p>
        </body>
        </html>
    `;
}

// Show notification
function showNotification(message, type = 'info') {
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Make functions available globally for onclick handlers
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;

