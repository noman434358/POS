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
const DEFAULT_EXCEL_URL = 'https://docs.google.com/spreadsheets/d/1L4iygFD3mB7jlJNAh97eeBfxkC7VBVYdwkH6Rb7SCMQ/edit?gid=1799151543#gid=1799151543';

// DOM Elements (will be initialized in DOMContentLoaded)
let productsGrid, cartItems, searchInput, loadBtn, refreshBtn, excelUrlInput;
let fileInput, fileBtn, clearCartBtn, checkoutBtn;
let totalEl, notification;

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
    
    // Clear old URLs from localStorage and use the latest Google Sheets URL
    const storedUrl = localStorage.getItem('excelUrl');
    // If stored URL is old (OneDrive or old Google Sheets), use default URL instead
    const oldSheetIds = [
        '1n4Qvos_RZLgex2pxisiJGYjgneDbmujRkJuRE-W0bEM',  // Old sheet 1
        '1mBy447WJ_QUle4MUA-GhZplP8UMowmuSJj6awjki5yQ'   // Old sheet 2
    ];
    const isOldUrl = storedUrl && (
        storedUrl.includes('onedrive') || 
        storedUrl.includes('excel.cloud.microsoft') ||
        oldSheetIds.some(oldId => storedUrl.includes(oldId))
    );
    
    if (isOldUrl) {
        console.log('[Init] Clearing old URL from storage');
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
        
        // Find column names that match our expected columns (case-insensitive, flexible matching)
        const allColumns = data.length > 0 ? Object.keys(data[0]) : [];
        console.log('All column names:', allColumns);
        
        // Find Urdu name column with flexible matching
        const urduColumn = allColumns.find(col => 
            /name.*urdu|urdu.*name/i.test(col) || 
            col.toLowerCase().includes('urdu')
        );
        console.log('Found Urdu column:', urduColumn);
        
        // Find English name column
        const englishColumn = allColumns.find(col => 
            /name.*english|english.*name/i.test(col) || 
            (col.toLowerCase().includes('name') && !col.toLowerCase().includes('urdu'))
        ) || allColumns.find(col => /^name$/i.test(col));
        console.log('Found English name column:', englishColumn);
        
        // Process products - handle both old and new column structures
        const rawProducts = data.map((row, index) => {
            // Try to find English name column (new structure) or Name (old structure)
            let name = '';
            if (englishColumn && row[englishColumn]) {
                name = row[englishColumn];
            } else {
                // Try new structure first
                name = row['Name (English)'] || row['name (english)'] || 
                       row['Name(English)'] || row['name(english)'] ||
                       // Then try old structure
                       row.Name || row.name || 
                       row.Product || row.product || 
                       row['Product Name'] || row['product name'] || 
                       row.Item || row.item || 'Unknown';
            }
            
            // Name (Urdu) - try multiple column name variations
            let nameUrdu = '';
            if (urduColumn && row[urduColumn]) {
                nameUrdu = row[urduColumn];
            } else {
                nameUrdu = row['Name (Urdu)'] || row['name (urdu)'] || 
                          row['Name(Urdu)'] || row['name(urdu)'] ||
                          row['Urdu Name'] || row['urdu name'] || '';
            }
            
            if (index === 0) {
                console.log('First product sample:', {
                    name: name,
                    nameUrdu: nameUrdu,
                    allRowKeys: Object.keys(row),
                    urduColumn: urduColumn,
                    urduValue: urduColumn ? row[urduColumn] : 'not found',
                    rowData: row
                });
            }
            
            // Barcode
            const barcode = row.Barcode || row.barcode || 
                           row.SKU || row.sku || 
                           row['Product Code'] || row['product code'] || '';
            
            // Unit type (Liter, Kg, Pack, etc.)
            const unit = String(row.Unit || row.unit || 
                               row['Unit Type'] || row['unit type'] || 
                               row.Type || row.type || 
                               'Kg').trim();
            
            // New price structure: Parchon, Gatta, Wholesale (single prices)
            const parchonPrice = parseFloat(row['Parchon Price'] || row['parchon price'] || 
                                           row['ParchonPrice'] || row['parchonprice'] || 0);
            const gattaPrice = parseFloat(row['Gatta Price'] || row['gatta price'] || 
                                         row['GattaPrice'] || row['gattaprice'] || 0);
            const wholesalePrice = parseFloat(row['Wholesale Price'] || row['wholesale price'] || 
                                             row['WholesalePrice'] || row['wholesaleprice'] || 0);
            
            // Default price: Use Parchon Price if available, otherwise first available price
            const defaultPrice = parchonPrice > 0 ? parchonPrice : 
                               (gattaPrice > 0 ? gattaPrice : 
                               (wholesalePrice > 0 ? wholesalePrice : 0));
            
            // Stock (not in new structure, set to 999 for unlimited or handle if column exists)
            const stock = parseInt(row.Stock || row.stock || 
                                  row.Quantity || row.quantity || 
                                  row['In Stock'] || row['in stock'] || 999);
            
            // Category (not in new structure, set to General)
            const category = row.Category || row.category || 
                            row['Product Category'] || row['product category'] || 
                            'General';
            
            // Legacy support: Min Price and Max Price (for backward compatibility)
            const minPrice = parseFloat(row['Min Price'] || row['min price'] || 
                                       row['MinPrice'] || row['minprice'] || 0);
            const maxPrice = parseFloat(row['Max Price'] || row['max price'] || 
                                       row['MaxPrice'] || row['maxprice'] || 0);
            
            // Build description from available fields
            let description = '';
            if (nameUrdu) {
                description = `Urdu: ${nameUrdu}`;
            }
            // Build price info string
            let priceInfo = [];
            if (parchonPrice > 0) {
                priceInfo.push(`Parchon: Rs.${parchonPrice.toFixed(2)}`);
            }
            if (gattaPrice > 0) {
                priceInfo.push(`Gatta: Rs.${gattaPrice.toFixed(2)}`);
            }
            if (wholesalePrice > 0) {
                priceInfo.push(`Wholesale: Rs.${wholesalePrice.toFixed(2)}`);
            }
            
            if (priceInfo.length > 0 && description) {
                description += ' | ' + priceInfo.join(', ');
            } else if (priceInfo.length > 0) {
                description = priceInfo.join(', ');
            }
            
            return {
                id: index + 1,
                name: String(name).trim(),
                price: defaultPrice, // Default price for display
                stock: stock,
                category: String(category).trim(),
                barcode: String(barcode).trim(),
                description: description || (row.Description || row.description || ''),
                nameUrdu: String(nameUrdu).trim(),
                unit: unit, // Unit type: Liter, Kg, Pack, etc.
                // New price structure (single prices)
                parchonPrice: parchonPrice,
                gattaPrice: gattaPrice,
                wholesalePrice: wholesalePrice,
                // Legacy support (for backward compatibility)
                parchonMinPrice: parchonPrice,
                parchonMaxPrice: parchonPrice,
                gattaMinPrice: gattaPrice,
                gattaMaxPrice: gattaPrice,
                wholesaleMinPrice: wholesalePrice,
                wholesaleMaxPrice: wholesalePrice,
                minPrice: minPrice,
                maxPrice: maxPrice
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
            // Show Urdu name if available
            const nameDisplay = product.nameUrdu ? 
                `${product.name}<br><small style="color: #666; font-size: 0.9em;">${product.nameUrdu}</small>` : 
                product.name;
            
            // Display default price (Parchon if available, otherwise first available)
            let displayPrice = product.parchonPrice || product.gattaPrice || product.wholesalePrice || product.price;
            
            return `
                <div class="product-card" data-id="${product.id}">
                    <div class="product-info">
                        <h3 class="product-name">${nameDisplay}</h3>
                        <p class="product-category">${product.category}</p>
                        <div class="product-details">
                            <span class="product-price">Rs.${displayPrice.toFixed(2)}</span>
                            <span class="product-stock">Stock: ${product.stock}</span>
                        </div>
                        ${(product.parchonPrice > 0 || product.gattaPrice > 0 || product.wholesalePrice > 0) ? 
                            `<div style="font-size: 11px; color: #666; margin-top: 5px;">
                                ${product.parchonPrice > 0 ? `Parchon: Rs.${product.parchonPrice.toFixed(2)}` : ''}
                                ${product.parchonPrice > 0 && product.gattaPrice > 0 ? ' | ' : ''}
                                ${product.gattaPrice > 0 ? `Gatta: Rs.${product.gattaPrice.toFixed(2)}` : ''}
                                ${(product.parchonPrice > 0 || product.gattaPrice > 0) && product.wholesalePrice > 0 ? ' | ' : ''}
                                ${product.wholesalePrice > 0 ? `Wholesale: Rs.${product.wholesalePrice.toFixed(2)}` : ''}
                            </div>` : ''}
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
        const nameUrdu = String(product.nameUrdu || '').toLowerCase();
        const category = String(product.category || '').toLowerCase();
        const barcode = String(product.barcode || '').toLowerCase();
        
        const nameMatch = name.includes(searchTerm);
        const nameUrduMatch = nameUrdu.includes(searchTerm);
        const categoryMatch = category.includes(searchTerm);
        const barcodeMatch = barcode.includes(searchTerm);
        
        return nameMatch || nameUrduMatch || categoryMatch || barcodeMatch;
    });
    
    console.log('Filtered products:', filtered.length);
    displayProducts(filtered);
}

// Price selection modal state
let selectedProductForPrice = null;
let selectedPrice = null;
let editingCartItemIndex = null; // Track if we're editing a cart item (null = adding new, number = editing existing)

// Quantity input modal state
let editingQuantityItemIndex = null;

// Show price selection modal with all price options
// If cartItemIndex is provided, we're editing an existing cart item
function showPriceModal(product, cartItemIndex = null) {
    selectedProductForPrice = product;
    editingCartItemIndex = cartItemIndex;
    
    // If editing, use current cart item price; otherwise use first available price
    if (cartItemIndex !== null && cart[cartItemIndex]) {
        selectedPrice = cart[cartItemIndex].price;
    } else {
        // Default to first available price (Parchon > Gatta > Wholesale > default price)
        selectedPrice = product.parchonPrice || product.gattaPrice || product.wholesalePrice || product.price;
    }
    
    const modal = document.getElementById('priceModal');
    const productName = document.getElementById('modalProductName');
    const priceOptions = document.getElementById('priceOptions');
    const customPriceInput = document.getElementById('customPriceInput');
    const modalTitle = modal.querySelector('.modal-header h3');
    
    productName.textContent = product.name;
    customPriceInput.value = selectedPrice.toFixed(2);
    
    // Update modal title based on whether we're adding or editing
    if (modalTitle) {
        modalTitle.textContent = cartItemIndex !== null ? 'Change Price' : 'Select Price';
    }
    
    // Build price options - show all available category prices
    let optionsHTML = '';
    
    // Parchon Price
    if (product.parchonPrice > 0) {
        optionsHTML += `
            <div class="price-option ${selectedPrice === product.parchonPrice ? 'selected' : ''}" 
                 onclick="selectPrice(${product.parchonPrice})">
                <div class="price-option-label">Parchon Price</div>
                <div class="price-option-value">Rs.${product.parchonPrice.toFixed(2)}</div>
            </div>
        `;
    }
    
    // Gatta Price
    if (product.gattaPrice > 0) {
        optionsHTML += `
            <div class="price-option ${selectedPrice === product.gattaPrice ? 'selected' : ''}" 
                 onclick="selectPrice(${product.gattaPrice})">
                <div class="price-option-label">Gatta Price</div>
                <div class="price-option-value">Rs.${product.gattaPrice.toFixed(2)}</div>
            </div>
        `;
    }
    
    // Wholesale Price
    if (product.wholesalePrice > 0) {
        optionsHTML += `
            <div class="price-option ${selectedPrice === product.wholesalePrice ? 'selected' : ''}" 
                 onclick="selectPrice(${product.wholesalePrice})">
                <div class="price-option-label">Wholesale Price</div>
                <div class="price-option-value">Rs.${product.wholesalePrice.toFixed(2)}</div>
            </div>
        `;
    }
    
    priceOptions.innerHTML = optionsHTML;
    
    // Update button text based on whether we're adding or editing
    const confirmButton = modal.querySelector('.modal-footer .btn-primary');
    if (confirmButton) {
        confirmButton.textContent = cartItemIndex !== null ? 'Update Price' : 'Add to Cart';
    }
    
    modal.style.display = 'block';
}

// Close price modal
function closePriceModal() {
    const modal = document.getElementById('priceModal');
    modal.style.display = 'none';
    selectedProductForPrice = null;
    selectedPrice = null;
    editingCartItemIndex = null;
}

// Close modal when clicking outside of it
if (typeof window.onclick === 'function') {
    const originalOnclick = window.onclick;
    window.onclick = function(event) {
        originalOnclick(event);
        const priceModal = document.getElementById('priceModal');
        const languageModal = document.getElementById('languageModal');
        if (event.target === priceModal) {
            closePriceModal();
        }
        if (event.target === languageModal) {
            closeLanguageModal();
        }
    };
} else {
    window.onclick = function(event) {
        const priceModal = document.getElementById('priceModal');
        const languageModal = document.getElementById('languageModal');
        if (event.target === priceModal) {
            closePriceModal();
        }
        if (event.target === languageModal) {
            closeLanguageModal();
        }
    };
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const priceModal = document.getElementById('priceModal');
    const languageModal = document.getElementById('languageModal');
    const quantityModal = document.getElementById('quantityModal');
    if (event.target === priceModal) {
        closePriceModal();
    }
    if (event.target === languageModal) {
        closeLanguageModal();
    }
    if (event.target === quantityModal) {
        closeQuantityModal();
    }
}

// Select a price option
function selectPrice(price) {
    selectedPrice = price;
    const customPriceInput = document.getElementById('customPriceInput');
    customPriceInput.value = price.toFixed(2);
    
    // Update selected state in UI
    document.querySelectorAll('.price-option').forEach(option => {
        option.classList.remove('selected');
        const optionPrice = parseFloat(option.querySelector('.price-option-value').textContent.replace('Rs.', '').trim());
        if (Math.abs(optionPrice - price) < 0.01) {
            option.classList.add('selected');
        }
    });
}

// Confirm price selection and add to cart or update cart item
function confirmPriceSelection() {
    if (!selectedProductForPrice) return;
    
    const customPriceInput = document.getElementById('customPriceInput');
    const customPrice = parseFloat(customPriceInput.value);
    
    if (isNaN(customPrice) || customPrice < 0) {
        showNotification('Please enter a valid price', 'error');
        return;
    }
    
    // Use custom price if entered, otherwise use selected price
    const finalPrice = customPrice > 0 ? customPrice : selectedPrice;
    
    // If editing an existing cart item, update it; otherwise add new item
    if (editingCartItemIndex !== null && cart[editingCartItemIndex]) {
        // Update existing cart item price
        cart[editingCartItemIndex].price = finalPrice;
        cart[editingCartItemIndex].customPrice = finalPrice;
        cart[editingCartItemIndex].originalPrice = selectedProductForPrice.price;
        updateCart();
        showNotification(`Price updated to Rs.${finalPrice.toFixed(2)}`, 'success');
    } else {
        // Add new item to cart
        addToCartWithPrice(selectedProductForPrice.id, finalPrice);
    }
    
    closePriceModal();
}

// Add to cart with specific price
function addToCartWithPrice(productId, price) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock === 0) {
        showNotification('Product is out of stock', 'error');
        return;
    }

    // Check if same product with same custom price already exists
    const cartItem = cart.find(item => 
        item.id === productId && 
        item.customPrice && 
        Math.abs(item.customPrice - price) < 0.01
    );
    
    if (cartItem) {
        // Same product with same price - increase quantity
        if (cartItem.quantity >= product.stock) {
            showNotification('Not enough stock available', 'error');
            return;
        }
        cartItem.quantity++;
    } else {
        // New item or different price - add new entry
        const isCustomPrice = Math.abs(price - product.price) > 0.01;
        cart.push({
            ...product,
            price: price, // Use the selected/custom price
            customPrice: isCustomPrice ? price : undefined, // Track if this is a custom price
            originalPrice: product.price, // Keep original for reference
            quantity: 1,
            unit: product.unit || 'Kg' // Preserve unit type
        });
    }

    updateCart();
    const priceMsg = Math.abs(price - product.price) > 0.01 ? ` at Rs.${price.toFixed(2)}` : '';
    showNotification(`${product.name} added to cart${priceMsg}`, 'success');
}

// Add to cart - always show price selection modal
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock === 0) {
        showNotification('Product is out of stock', 'error');
        return;
    }

    // Always show price selection modal with all available prices
    showPriceModal(product);
}

// Make functions available globally
window.addToCart = addToCart;
window.selectPrice = selectPrice;
window.closePriceModal = closePriceModal;
window.confirmPriceSelection = confirmPriceSelection;

// Remove from cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

// Update quantity by product ID (for backward compatibility)
function updateQuantity(productId, change) {
    // Find first item with this ID
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

// Format quantity for display based on product unit
function formatQuantity(quantity, unit = 'Kg') {
    if (quantity <= 0) {
        return '0';
    }
    
    // Normalize unit name (handle variations)
    const normalizedUnit = String(unit).trim();
    const unitLower = normalizedUnit.toLowerCase();
    
    // Handle different unit types
    if (unitLower === 'kg' || unitLower === 'kilogram' || unitLower === 'kgs') {
        // For Kg: show as kg or gm
        if (quantity >= 1) {
            return `${quantity.toFixed(quantity % 1 === 0 ? 0 : 2)} kg`;
        } else {
            const grams = Math.round(quantity * 1000);
            return `${grams} gm`;
        }
    } else if (unitLower === 'liter' || unitLower === 'litre' || unitLower === 'l' || unitLower === 'liters' || unitLower === 'litres') {
        // For Liter: show as Liter or ml
        if (quantity >= 1) {
            return `${quantity.toFixed(quantity % 1 === 0 ? 0 : 2)} Liter`;
        } else {
            const ml = Math.round(quantity * 1000);
            return `${ml} ml`;
        }
    } else if (unitLower === 'pack' || unitLower === 'packs' || unitLower === 'pcs' || unitLower === 'piece' || unitLower === 'pieces') {
        // For Pack/Piece: show as whole number
        return `${Math.round(quantity)} ${normalizedUnit}`;
    } else {
        // Default: show with unit
        return `${quantity.toFixed(quantity % 1 === 0 ? 0 : 2)} ${normalizedUnit}`;
    }
}

// Parse quantity input based on product unit (handles "2.5 kg", "500 gm", "2.5 Liter", "500 ml", "3 Pack", etc.)
function parseQuantity(input, unit = 'Kg') {
    if (!input || typeof input !== 'string') {
        return parseFloat(input) || 0;
    }
    
    const trimmed = input.trim().toLowerCase();
    const unitLower = String(unit).toLowerCase();
    
    // Try to parse as number first
    const numberMatch = trimmed.match(/^([\d.]+)/);
    if (!numberMatch) {
        return 0;
    }
    
    const value = parseFloat(numberMatch[1]);
    if (isNaN(value)) {
        return 0;
    }
    
    // Check for unit in input
    if (trimmed.includes('gm') || trimmed.includes('gram')) {
        // Convert grams to kg
        return value / 1000;
    } else if (trimmed.includes('ml') || trimmed.includes('milliliter') || trimmed.includes('millilitre')) {
        // Convert ml to Liter
        return value / 1000;
    } else if (trimmed.includes('kg') || trimmed.includes('kilogram')) {
        // Already in kg
        return value;
    } else if (trimmed.includes('liter') || trimmed.includes('litre') || trimmed.includes('l ')) {
        // Already in Liter
        return value;
    } else if (trimmed.includes('pack') || trimmed.includes('pcs') || trimmed.includes('piece')) {
        // Pack/Piece - return as whole number
        return Math.round(value);
    } else {
        // No unit specified, return value as-is (will be formatted based on product unit)
        return value;
    }
}

// Update quantity by index (handles items with custom prices)
function updateQuantityByIndex(itemIndex, change) {
    if (itemIndex < 0 || itemIndex >= cart.length) return;
    
    const cartItem = cart[itemIndex];
    const product = products.find(p => p.id === cartItem.id);
    const unit = (cartItem.unit || product.unit || 'Kg').toLowerCase();
    
    // Determine increment step based on unit type
    let step = change;
    if (unit === 'pack' || unit === 'pcs' || unit === 'piece' || unit === 'packs' || unit === 'pieces') {
        // For Pack/Piece: increment by 1
        step = change > 0 ? 1 : -1;
    } else {
        // For Kg/Liter: increment by 0.1 (100 gm or 100 ml)
        step = change > 0 ? 0.1 : -0.1;
    }
    
    const newQuantity = Math.max(0, cartItem.quantity + step);

    if (newQuantity <= 0) {
        cart.splice(itemIndex, 1);
        updateCart();
        return;
    }

    if (product.stock > 0 && newQuantity > product.stock) {
        showNotification('Not enough stock available', 'error');
        return;
    }

    cartItem.quantity = newQuantity;
    // Ensure unit is preserved
    if (!cartItem.unit) {
        cartItem.unit = product.unit || 'Kg';
    }
    updateCart();
}

// Remove from cart by index
function removeFromCartByIndex(itemIndex) {
    if (itemIndex >= 0 && itemIndex < cart.length) {
        cart.splice(itemIndex, 1);
        updateCart();
    }
}

// Edit cart item price
function editCartItemPrice(itemIndex) {
    if (itemIndex < 0 || itemIndex >= cart.length) return;
    
    const cartItem = cart[itemIndex];
    // Find the original product to get all available prices
    const product = products.find(p => p.id === cartItem.id);
    
    if (!product) {
        showNotification('Product not found', 'error');
        return;
    }
    
    // Show price modal with the cart item's product and current index
    showPriceModal(product, itemIndex);
}

// Edit cart item quantity
function editQuantity(itemIndex) {
    if (itemIndex < 0 || itemIndex >= cart.length) return;
    
    const cartItem = cart[itemIndex];
    const product = products.find(p => p.id === cartItem.id);
    
    if (!product) {
        showNotification('Product not found', 'error');
        return;
    }
    
    editingQuantityItemIndex = itemIndex;
    
    const modal = document.getElementById('quantityModal');
    const productName = document.getElementById('quantityModalProductName');
    const quantityInput = document.getElementById('quantityInput');
    const unit = product.unit || 'Kg';
    
    productName.textContent = `${product.name} (Unit: ${unit})`;
    // Pre-fill with current quantity in readable format
    quantityInput.value = formatQuantity(cartItem.quantity, unit);
    
    // Update placeholder and help text based on unit
    const unitLower = unit.toLowerCase();
    let placeholder = '';
    let helpText = '';
    
    if (unitLower === 'kg' || unitLower === 'kilogram') {
        placeholder = 'e.g., 2.5 kg or 500 gm';
        helpText = 'Examples: 2.5 kg, 500 gm, or just 2';
    } else if (unitLower === 'liter' || unitLower === 'litre' || unitLower === 'l') {
        placeholder = 'e.g., 2.5 Liter or 500 ml';
        helpText = 'Examples: 2.5 Liter, 500 ml, or just 2';
    } else if (unitLower === 'pack' || unitLower === 'pcs' || unitLower === 'piece') {
        placeholder = 'e.g., 3 Pack or 5';
        helpText = `Examples: 3 ${unit}, 5 ${unit}, or just 3`;
    } else {
        placeholder = `e.g., 2.5 ${unit} or 2`;
        helpText = `Examples: 2.5 ${unit}, 2 ${unit}, or just 2`;
    }
    
    quantityInput.placeholder = placeholder;
    const helpTextEl = modal.querySelector('.modal-body small');
    if (helpTextEl) {
        helpTextEl.textContent = helpText;
    }
    
    // Remove old event listener if exists
    quantityInput.onkeypress = null;
    
    // Add Enter key support
    quantityInput.onkeypress = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmQuantitySelection();
        }
    };
    
    modal.style.display = 'block';
    // Focus and select the input
    setTimeout(() => {
        quantityInput.focus();
        quantityInput.select();
    }, 100);
}

// Close quantity modal
function closeQuantityModal() {
    const modal = document.getElementById('quantityModal');
    modal.style.display = 'none';
    editingQuantityItemIndex = null;
    const quantityInput = document.getElementById('quantityInput');
    if (quantityInput) quantityInput.value = '';
}

// Confirm quantity selection
function confirmQuantitySelection() {
    if (editingQuantityItemIndex === null || editingQuantityItemIndex < 0 || editingQuantityItemIndex >= cart.length) {
        return;
    }
    
    const quantityInput = document.getElementById('quantityInput');
    const inputValue = quantityInput.value.trim();
    
    if (!inputValue) {
        showNotification('Please enter a quantity', 'error');
        return;
    }
    
    const cartItem = cart[editingQuantityItemIndex];
    const product = products.find(p => p.id === cartItem.id);
    const unit = product.unit || 'Kg';
    
    const parsedQuantity = parseQuantity(inputValue, unit);
    
    if (parsedQuantity <= 0) {
        showNotification('Quantity must be greater than 0', 'error');
        return;
    }
    
    if (product.stock > 0 && parsedQuantity > product.stock) {
        showNotification('Not enough stock available', 'error');
        return;
    }
    
    cartItem.quantity = parsedQuantity;
    // Ensure unit is preserved
    if (!cartItem.unit) {
        cartItem.unit = unit;
    }
    updateCart();
    showNotification(`Quantity updated to ${formatQuantity(parsedQuantity, unit)}`, 'success');
    closeQuantityModal();
}

// Update cart display
function updateCart() {
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart">Cart is empty</div>';
        updateSummary();
        return;
    }

    cartItems.innerHTML = cart.map((item, index) => {
        // Check if this item has a custom price
        const hasCustomPrice = item.customPrice && item.customPrice !== item.originalPrice;
        const priceDisplay = hasCustomPrice ? 
            `<p>Rs.${item.price.toFixed(2)} each <span style="color: #ff9800; font-size: 0.85em;">(Custom)</span></p>` :
            `<p>Rs.${item.price.toFixed(2)} each</p>`;
        
        // Use a unique key for items with same ID but different prices
        const itemKey = hasCustomPrice ? `${item.id}_${item.price}_${index}` : item.id;
        
        return `
        <div class="cart-item" data-item-key="${itemKey}">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                ${priceDisplay}
            </div>
            <div class="cart-item-controls">
                <button class="btn-quantity" onclick="updateQuantityByIndex(${index}, -1)">-</button>
                <span class="quantity" onclick="editQuantity(${index})" style="cursor: pointer; padding: 5px; border-radius: 4px; min-width: 80px; user-select: none;" title="Click to edit quantity">${formatQuantity(item.quantity, item.unit || 'Kg')}</span>
                <button class="btn-quantity" onclick="updateQuantityByIndex(${index}, 1)">+</button>
                <button class="btn-edit" onclick="editCartItemPrice(${index})" title="Change Price">✎</button>
                <button class="btn-remove" onclick="removeFromCartByIndex(${index})">×</button>
            </div>
            <div class="cart-item-total">
                Rs.${(item.price * item.quantity).toFixed(2)}
            </div>
        </div>
    `;
    }).join('');

    updateSummary();
}

// Update summary
function updateSummary() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    totalEl.textContent = `Rs.${total.toFixed(2)}`;
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
// Language selection state
let selectedReceiptLanguage = 'english';

// Show language selection modal
function showLanguageModal() {
    const modal = document.getElementById('languageModal');
    modal.style.display = 'block';
}

// Close language modal
function closeLanguageModal() {
    const modal = document.getElementById('languageModal');
    modal.style.display = 'none';
}

// Select language and proceed with checkout
function selectLanguage(language) {
    selectedReceiptLanguage = language;
    closeLanguageModal();
    proceedWithCheckout();
}

// Proceed with checkout after language selection
function proceedWithCheckout() {
    const receipt = generateReceipt(selectedReceiptLanguage);
    
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

function checkout() {
    if (cart.length === 0) {
        showNotification('Cart is empty', 'error');
        return;
    }

    // Show language selection modal first
    showLanguageModal();
}

// Generate receipt with language support
function generateReceipt(language = 'english') {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const date = new Date().toLocaleString();

    // Language translations
    const translations = {
        english: {
            receipt: 'Receipt',
            date: 'Date',
            item: 'Item',
            quantity: 'Quantity',
            price: 'Price',
            total: 'Total',
            thankYou: 'Thank you for your purchase!'
        },
        urdu: {
            receipt: 'رسید',
            date: 'تاریخ',
            item: 'آئٹم',
            quantity: 'مقدار',
            price: 'قیمت',
            total: 'کل',
            thankYou: 'آپ کی خریداری کا شکریہ!'
        }
    };

    const t = translations[language] || translations.english;
    const isUrdu = language === 'urdu';
    const fontFamily = isUrdu ? 'Arial, "Noto Nastaliq Urdu", "Al Qalam Taj Nastaliq", sans-serif' : 'Arial, sans-serif';
    const textAlign = isUrdu ? 'right' : 'left';

    return `
        <!DOCTYPE html>
        <html dir="${isUrdu ? 'rtl' : 'ltr'}">
        <head>
            <meta charset="UTF-8">
            <title>${t.receipt}</title>
            <style>
                body { font-family: ${fontFamily}; padding: 20px; direction: ${isUrdu ? 'rtl' : 'ltr'}; }
                h1 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 8px; text-align: ${textAlign}; border-bottom: 1px solid #ddd; }
                th { background-color: #f2f2f2; }
                .total { font-weight: bold; font-size: 1.2em; }
                .right { text-align: ${isUrdu ? 'left' : 'right'}; }
            </style>
        </head>
        <body>
            <h1>${t.receipt}</h1>
            <p><strong>${t.date}:</strong> ${date}</p>
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
                    ${cart.map(item => {
                        const itemName = isUrdu && item.nameUrdu ? item.nameUrdu : item.name;
                        return `
                        <tr>
                            <td>${itemName}</td>
                            <td>${formatQuantity(item.quantity, item.unit || 'Kg')}</td>
                            <td>Rs.${item.price.toFixed(2)}</td>
                            <td>Rs.${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr class="total">
                        <td colspan="3" class="right">${t.total}:</td>
                        <td>Rs.${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            <p style="text-align: center; margin-top: 30px;">${t.thankYou}</p>
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
window.updateQuantityByIndex = updateQuantityByIndex;
window.removeFromCartByIndex = removeFromCartByIndex;
window.editCartItemPrice = editCartItemPrice;
window.editQuantity = editQuantity;
window.closeQuantityModal = closeQuantityModal;
window.confirmQuantitySelection = confirmQuantitySelection;
window.selectLanguage = selectLanguage;
window.closeLanguageModal = closeLanguageModal;

