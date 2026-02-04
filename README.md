# Point of Sale System

A modern Point of Sale (POS) system built with Electron.js that fetches product data from an online Excel file.

## Features

- 📊 **Excel Integration**: Load product data from online Excel files (.xlsx) or local files
- 📁 **Local File Support**: Choose Excel files directly from your computer
- 🛒 **Shopping Cart**: Add, remove, and update quantities
- 🔍 **Product Search**: Search products by name, category, or barcode
- 💰 **Automatic Calculations**: Subtotal, tax (10%), and total calculations
- 🧾 **Receipt Generation**: Print receipts after checkout
- 💾 **URL Persistence**: Remembers your Excel file URL
- 🎨 **Modern UI**: Beautiful, responsive interface

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

1. Start the application:
```bash
npm start
```

2. **Option A - Load from Local File:**
   - Click "Choose File" button
   - Select your Excel file (.xlsx or .xls)
   - Products will load automatically

3. **Option B - Load from URL:**
   - Enter your Excel file URL in the input field
   - Click "Load from URL" to fetch and load products
   - **For Google Drive**: Make sure the file is set to "Anyone with the link can view"
   - **For OneDrive/Microsoft 365**: 
     - The app will attempt to convert the sharing link automatically
     - If you get an authentication error, download the file and use "Choose File" instead
     - Or ensure the file is set to "Anyone with the link can view" and use the direct download link

4. Add products to cart and checkout!

## Excel File Format

Your Excel file should have the following columns (case-insensitive):

- **Name** / **Product**: Product name
- **Price** / **Cost**: Product price (numeric)
- **Stock** / **Quantity**: Available stock (numeric)
- **Category**: Product category
- **Barcode** / **SKU**: Product barcode/SKU (optional)
- **Description**: Product description (optional)

### Example Excel Structure:

| Name | Price | Stock | Category | Barcode |
|------|-------|-------|----------|---------|
| Apple | 1.50 | 100 | Fruits | 123456 |
| Bread | 2.00 | 50 | Bakery | 789012 |
| Milk | 3.50 | 75 | Dairy | 345678 |

## Development

Run in development mode with DevTools:
```bash
npm run dev
```

## Troubleshooting

### Excel File Not Loading from URL

**Common Issues:**

1. **CORS Error**: The file server doesn't allow cross-origin requests
   - **Solution**: Use the "Choose File" option instead, or host the file on a server that allows CORS

2. **Google Drive Access Denied (403)**
   - **Solution**: 
     - Right-click the file in Google Drive
     - Select "Share" → "Change to anyone with the link"
     - Copy the sharing link and use it

3. **File Not Found (404)**
   - **Solution**: Check that the URL is correct and the file is publicly accessible

4. **Empty File or No Products**
   - **Solution**: 
     - Ensure your Excel file has headers in the first row
     - Check that columns are named: Name, Price, Stock (case-insensitive)
     - Verify the file has data rows

5. **Invalid File Format**
   - **Solution**: Ensure the file is a valid .xlsx or .xls format

**Best Practice**: If you're having trouble with URLs, use the "Choose File" option - it's more reliable and doesn't require internet access.

## Notes

- Supported formats: .xlsx (Excel 2007+) and .xls (older Excel format)
- The application uses the first sheet in the Excel workbook
- Tax rate is set to 10% (can be modified in `renderer.js`)
- Column names are case-insensitive and support various formats (Name/name/Product/product)

## License

MIT

# POS
