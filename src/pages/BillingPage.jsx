import React, { useState, useEffect } from 'react';
import { getProducts, addTransaction, getUniqueCustomers, addLedgerAdjustment } from '../api/supabaseApi';
import { Box, Button, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Grid, Snackbar, Select, MenuItem, Autocomplete } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CloseIcon from '@mui/icons-material/Close';

function BillingPage() {
  const toRoman = (num) => {
    if (num <= 0 || num > 3999) return num.toString();
    const romanNumerals = [
      { value: 1000, symbol: 'M' },
      { value: 900, symbol: 'CM' },
      { value: 500, symbol: 'D' },
      { value: 400, symbol: 'CD' },
      { value: 100, symbol: 'C' },
      { value: 90, symbol: 'XC' },
      { value: 50, symbol: 'L' },
      { value: 40, symbol: 'XL' },
      { value: 10, symbol: 'X' },
      { value: 9, symbol: 'IX' },
      { value: 5, symbol: 'V' },
      { value: 4, symbol: 'IV' },
      { value: 1, symbol: 'I' }
    ];
    let result = '';
    for (let i = 0; i < romanNumerals.length; i++) {
      while (num >= romanNumerals[i].value) {
        result += romanNumerals[i].symbol;
        num -= romanNumerals[i].value;
      }
    }
    return result;
  };

  const [customer, setCustomer] = useState({ name: '', contact: '' });
  const [transactions, setTransactions] = useState([
    { productId: '', quantity: '', actualPrice: '', transactionPrice: '', totalPrice: '', amountPaid: 0, transactionType: 'sell', costPrice: '' }
  ]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [snackbarQueue, setSnackbarQueue] = useState([]);

  const addSnackbar = (message) => {
    setSnackbarQueue(prev => [message, ...prev]);
  };

  const removeSnackbar = () => {
    setSnackbarQueue(prev => prev.slice(1));
  };

  const [billGenerated, setBillGenerated] = useState(false);
  const [billHtml, setBillHtml] = useState('');
  const [lastBillData, setLastBillData] = useState({ customer: { name: '', contact: '' }, transactions: [], total: 0, grossTotal: 0, paidAmount: 0 });
  const [lastPayloadHash, setLastPayloadHash] = useState(null);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountPercent, setDiscountPercent] = useState(0);

  useEffect(() => {
    getProducts().then(setProducts).catch(e => addSnackbar(e.message));
    getUniqueCustomers().then(setCustomers).catch(() => {});
  }, []);

  const calculateTotalProfit = () => {
    return transactions.reduce((sum, t) => {
      const profit = (parseFloat(t.transactionPrice || 0) - parseFloat(t.costPrice || 0)) * parseFloat(t.quantity || 0);
      return t.transactionType === 'return' ? sum - profit : sum + profit;
    }, 0);
  };

  useEffect(() => {
    const totalProfit = calculateTotalProfit();
    const discount = (discountPercent / 100) * totalProfit;
    setDiscountAmount(discount.toFixed(2));
  }, [discountPercent, transactions]);



  const handleTxnChange = (idx, field, value) => {
    const newTxns = [...transactions];
    newTxns[idx][field] = value;
    // If product or transactionType changes, update actualPrice, transactionPrice, and costPrice
    if (field === 'productId' || field === 'transactionType') {
      const product = products.find(p => p.id === parseInt(newTxns[idx].productId));
      if (product) {
        const actualPrice = newTxns[idx].transactionType === 'return' ? product.sellPrice : product.sellPrice;
        newTxns[idx].actualPrice = actualPrice;
        newTxns[idx].transactionPrice = actualPrice;
        newTxns[idx].costPrice = product.costPrice;
      } else {
        newTxns[idx].actualPrice = '';
        newTxns[idx].transactionPrice = '';
        newTxns[idx].costPrice = '';
      }
    }
    // If quantity or transactionPrice changes, update totalPrice
    if (field === 'quantity' || field === 'transactionPrice') {
      newTxns[idx].totalPrice = (parseFloat(newTxns[idx].transactionPrice || 0) * parseFloat(newTxns[idx].quantity || 0)).toFixed(2);
    }
    // Check for insufficient stock if type is 'sell' and quantity is set
    if (field === 'quantity' && newTxns[idx].transactionType === 'sell' && value) {
      const product = products.find(p => p.id === parseInt(newTxns[idx].productId));
      if (product && parseFloat(value) > product.stock) {
        addSnackbar(`Insufficient stock for product ${product.name}. Available: ${product.stock}, requested: ${value}`);
        return; // Do not update transactions if insufficient stock
      }
    }
    setTransactions(newTxns);
  };

  const addTxnRow = () => {
    setTransactions([...transactions, { productId: '', quantity: '', actualPrice: '', transactionPrice: '', totalPrice: '', amountPaid: 0, transactionType: 'sell', costPrice: '' }]);
  };

  const removeTxnRow = (idx) => {
    setTransactions(transactions.filter((_, i) => i !== idx));
  };

  const total = transactions.reduce((sum, t) => {
    const price = parseFloat(t.totalPrice || 0);
    return t.transactionType === 'return' ? sum - price : sum + price;
  }, 0);
  const adjustedTotal = total - parseFloat(paymentAmount || 0) - parseFloat(discountAmount || 0);

  const handleSaveAndGenerateBill = async () => {
    const errors = [];

    // Check for duplicate submission within 2 minutes
    const currentTime = new Date().getTime();
    const payload = { customer, transactions };
    const payloadString = JSON.stringify(payload);
    const payloadHash = btoa(payloadString); // Simple hash using base64

    if (lastPayloadHash === payloadHash && (currentTime - lastSubmissionTime) < 120000) { // 2 minutes = 120000 ms
      errors.push('Duplicate submission detected. Please wait before submitting again.');
    }

    // Validate customer details
    if (!customer.name.trim()) {
      errors.push('Customer name cannot be empty.');
    }
    if (!customer.contact.trim()) {
      errors.push('Customer contact cannot be empty.');
    }

    // Validate transactions
    transactions.forEach((t, idx) => {
      if (!t.productId) {
        errors.push(`Transaction ${idx + 1}: Product is required.`);
      }
      if (!t.quantity || parseFloat(t.quantity) <= 0) {
        errors.push(`Transaction ${idx + 1}: Quantity must be greater than 0.`);
      }
      if (!t.transactionPrice || parseFloat(t.transactionPrice) <= 0) {
        errors.push(`Transaction ${idx + 1}: Transaction price must be greater than 0.`);
      }
      if (t.amountPaid === undefined || t.amountPaid === '') {
        errors.push(`Transaction ${idx + 1}: Amount paid is required.`);
      }
      if (!t.transactionType) {
        errors.push(`Transaction ${idx + 1}: Transaction type is required.`);
      }
    });

    // Refresh products to get latest stock
    let updatedProducts;
    try {
      updatedProducts = await getProducts();
      setProducts(updatedProducts);
    } catch (e) {
      errors.push('Failed to refresh product stock: ' + e.message);
    }

    // Validate aggregated sell quantities against product stock
    if (updatedProducts) {
      const sellTotalsByProduct = {};
      transactions.forEach((t, idx) => {
        if (t.transactionType === 'sell' && t.productId && t.quantity) {
          const pid = parseInt(t.productId);
          sellTotalsByProduct[pid] = (sellTotalsByProduct[pid] || 0) + parseFloat(t.quantity);
        }
      });
      for (const pidStr of Object.keys(sellTotalsByProduct)) {
        const pid = parseInt(pidStr);
        const prod = updatedProducts.find(p => p.id === pid);
        if (!prod) {
          errors.push(`Product not found for id ${pid}`);
        } else if (prod.stock < sellTotalsByProduct[pid]) {
          errors.push(`Insufficient stock for product ${prod.name}. Available: ${prod.stock}, requested: ${sellTotalsByProduct[pid]}`);
        }
      }
    }

    // If there are any errors, show them and do not proceed
    if (errors.length > 0) {
      errors.forEach(error => addSnackbar(error));
      return;
    }

    // Proceed to save if no errors
    try {
      for (const t of transactions) {
        await addTransaction({
          product_id: parseInt(t.productId),
          quantity: parseFloat(t.quantity),
          actualPrice: parseFloat(t.actualPrice),
          transactionPrice: parseFloat(t.transactionPrice),
          totalPrice: parseFloat(t.totalPrice),
          amountPaid: parseFloat(t.amountPaid),
          transaction_type: t.transactionType,
          person_name: customer.name,
          contact: customer.contact,
          transaction_date: new Date().toISOString(),
        });
      }
      // Add ledger adjustment if payment amount is provided
      if (parseFloat(paymentAmount) > 0) {
        await addLedgerAdjustment({
          person_name: customer.name,
          contact: customer.contact,
          adjustment_amount: parseFloat(paymentAmount),
          adjustment_date: new Date().toISOString(),
          reason: 'Paid while billing',
        });
      }
      // Add ledger adjustment if discount amount is provided
      if (parseFloat(discountAmount) !== 0) {
        await addLedgerAdjustment({
          person_name: customer.name,
          contact: customer.contact,
          adjustment_amount: parseFloat(discountAmount),
          adjustment_date: new Date().toISOString(),
          reason: parseFloat(discountAmount) > 0 ? 'Discount' : 'Discount adjustment',
        });
      }
      // Store the bill data before clearing inputs
      setLastBillData({ customer: customer, transactions: transactions, total: adjustedTotal, grossTotal: total, paidAmount: parseFloat(paymentAmount) || 0, discountAmount: parseFloat(discountAmount) || 0 });
      // Update duplicate prevention state
      setLastPayloadHash(payloadHash);
      setLastSubmissionTime(currentTime);
      // Clear inputs after successful save
      setCustomer({ name: '', contact: '' });
      setTransactions([{ productId: '', quantity: '', actualPrice: '', transactionPrice: '', totalPrice: '', amountPaid: 0, transactionType: 'sell', costPrice: '' }]);
      setPaymentAmount('');
      setDiscountAmount('');
      setDiscountPercent(0);
      setBillGenerated(true);
      setBillHtml(generateBillHtml(customer, transactions, total, parseFloat(paymentAmount) || 0, parseFloat(discountAmount) || 0));
      addSnackbar('Bill generated and saved!');
    } catch (e) {
      addSnackbar(e.message);
    }
  };

  const generateBillHtml = (customer, transactions, total, paidAmount = 0, discountAmount = 0) => {
    const adjustedTotal = total - paidAmount - discountAmount;
    const allReturn = transactions.every(t => t.transactionType === 'return');
    let rows = transactions.map((t, i) => {
      const prod = products.find(p => p.id == t.productId);
      return `<tr><td>${i + 1}</td><td>${prod ? prod.name : ''}</td><td>${t.quantity}</td><td>${t.transactionPrice}</td><td>${t.totalPrice}</td><td>${t.transactionType}</td></tr>`;
    }).join('');
    return `
      <div style="position:relative; min-height:800px;">
        <div style="position:absolute; top:40%; left:10%; font-size:60px; color:#e0e0e0; opacity:0.18; transform:rotate(-30deg); pointer-events:none; z-index:0; user-select:none; width:80%; text-align:center;">
          JHARKHAND STEEL
        </div>
        <div style="position:relative; z-index:1;">
          <h2>Bill</h2>
          <p><b>Name:</b> ${customer.name} <b>Contact:</b> ${customer.contact}</p>
          <table border="1" cellpadding="5" cellspacing="0">
            <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Type</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <br>
          ${!allReturn ? `<p><b>Payment Amount:</b> ${paidAmount.toFixed(2)}</p>` : ''}
          ${discountAmount > 0 ? `<p><b>Discount:</b> ${discountAmount.toFixed(2)}</p>` : ''}
          ${!allReturn ? `<p><b>Due:</b> ${adjustedTotal.toFixed(2)}</p>` : ''}
          <p>Date: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;
  };

  const handleDownloadHTML = () => {
    const allReturn = lastBillData.transactions.every(t => t.transactionType === 'return');
    const htmlContent = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Bill</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h2 { text-align: center; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #888; padding: 8px 6px; text-align: center; font-size: 13px; }
        th { background: #f0f0f0; }
        .bill-header { margin-bottom: 10px; }
        .bill-footer { margin-top: 20px; font-weight: bold; }
        .watermark { position: absolute; top: 40%; left: 10%; font-size: 60px; color: #e0e0e0; opacity: 0.18; transform: rotate(-30deg); pointer-events: none; z-index: 0; user-select: none; width: 80%; text-align: center; }
        .bill-content { position: relative; z-index: 1; }
        @media print { .watermark { position: fixed; } }
      </style>
    </head><body>
      <div style='position:relative; min-height:800px;'>
        <div class='watermark'>JHARKHAND STEEL</div>
        <div class='bill-content'>
          <h2>Bill</h2>
          <div class='bill-header'><b>Name:</b> ${lastBillData.customer.name} &nbsp;&nbsp; <b>Contact:</b> ${lastBillData.customer.contact}</div>
          <div class='bill-header'><b>Date:</b> ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Type</th></tr></thead>
            <tbody>
              ${lastBillData.transactions.map((t, i) => {
                const prod = products.find(p => p.id == t.productId);
                return `<tr><td>${i + 1}</td><td>${prod ? prod.name : ''}</td><td>${t.quantity}</td><td>${t.transactionPrice}</td><td>${t.totalPrice}</td><td>${t.transactionType}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
          <br>
          ${!allReturn ? `<div class='bill-header'><b>Payment Amount:</b> ${lastBillData.paidAmount.toFixed(2)}</div>` : ''}
          ${lastBillData.discountAmount > 0 ? `<div class='bill-header'><b>Discount:</b> ${lastBillData.discountAmount.toFixed(2)}</div>` : ''}
          ${!allReturn ? `<div class='bill-footer'>Due: ${lastBillData.total.toFixed(2)}</div>` : ''}
        </div>
      </div>
    </body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const formattedDate = `${dd}_${mm}_${yyyy}`;
    a.download = `bill_${lastBillData.customer.name}_${formattedDate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload57mm = () => {
    const allReturn = lastBillData.transactions.every(t => t.transactionType === 'return');
    const htmlContent = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>57mm Bill</title>
      <style>
        body { font-family: monospace; font-size: 10px; margin: 0; padding: 5px; width: 200px; word-wrap: break-word; overflow-wrap: break-word; }
        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
        .item { margin-bottom: 5px; }
        .header { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 2px 0; vertical-align: top; }
        .num { width: 10%; text-align: center; }
        .prod { width: 45%; word-wrap: break-word; overflow-wrap: break-word; }
        .qty { width: 15%; text-align: center; }
        .total { width: 20%; text-align: right; }
        .type { width: 10%; text-align: center; }
      </style>
    </head><body>
      <div class='center header'>JHARKHAND STEEL</div>
      <div class='center header'>BILL</div>
      <br>
      <div class='left item'>Name: ${lastBillData.customer.name}</div>
      <div class='left item'>Contact: ${lastBillData.customer.contact}</div>
      <div class='left item'>Date: ${new Date().toLocaleString()}</div>
      <br>
      <table>
        <thead>
          <tr><th class='center'>#</th><th class='left'>Prod</th><th class='center'>Qty</th><th class='right'>Total</th><th class='center'>Type</th></tr>
        </thead>
        <tbody>
          ${lastBillData.transactions.map((t, i) => {
            const prod = products.find(p => p.id == t.productId);
            const prodName = prod ? prod.name : '';
            return `<tr><td class='center'>${i + 1}</td><td class='prod'>${prodName}</td><td class='qty'>${t.quantity}</td><td class='total'>${t.totalPrice}</td><td class='center'>${t.transactionType.substring(0, 4)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
      <br>
      ${!allReturn ? `<div class='left item'>Paid: ${lastBillData.paidAmount.toFixed(2)}</div>` : ''}
      ${lastBillData.discountAmount > 0 ? `<div class='left item'>Disc: ${lastBillData.discountAmount.toFixed(2)}</div>` : ''}
      ${!allReturn ? `<div class='right item'>Due: ${lastBillData.total.toFixed(2)}</div>` : ''}
      <br>
      <div class='center'>Thank you!</div>
    </body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const formattedDate = `${dd}_${mm}_${yyyy}`;
    a.download = `bill_57mm_${lastBillData.customer.name}_${formattedDate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to get contact by name
  const getContactByName = (name) => {
    const found = customers.find(c => c.person_name === name);
    return found ? found.contact : '';
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Billing</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <div style={{ width: '300px' }}>
          <Autocomplete
            freeSolo
            options={customers.map(c => c.person_name).filter(Boolean)}
            value={customer.name}
            onChange={(_, newValue) => {
              // On name change, update name and auto-fill contact if found
              setCustomer(c => {
                const contact = getContactByName(newValue || '');
                return { ...c, name: newValue || '', contact };
              });
            }}
            onInputChange={(_, newInputValue) => {
              // On name input, update name and auto-fill contact if found
              setCustomer(c => {
                const contact = getContactByName(newInputValue);
                return { ...c, name: newInputValue, contact };
              });
            }}
            renderInput={params => (
              <TextField {...params} label="Customer Name" fullWidth margin="normal" required />
            )}
          />
          </div>
        </Grid>
        <Grid item xs={12} sm={6}>
          <div style={{ width: '300px' }}>
          <Autocomplete
            freeSolo
            options={customers.map(c => c.contact).filter(Boolean)}
            value={customer.contact}
            onChange={(_, newValue) => {
              // On contact change, only update contact
              setCustomer(c => ({ ...c, contact: newValue || '' }));
            }}
            onInputChange={(_, newInputValue) => {
              // On contact input, only update contact
              setCustomer(c => ({ ...c, contact: newInputValue }));
            }}
            renderInput={params => (
              <TextField {...params} label="Contact" fullWidth margin="normal" required />
            )}
          />
          </div>
        </Grid>
      </Grid>
      <TableContainer component={Paper} sx={{ mt: 2, overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Actual Price</TableCell>
              <TableCell>Threshold</TableCell>
              <TableCell>Txn Price</TableCell>
              <TableCell>Paid</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Type</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((t, idx) => (
              <TableRow key={idx}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>
                  <div style={{ width: '300px' }}>
                  <Autocomplete
                    options={products}
                    getOptionLabel={option => option.name || ''}
                    value={products.find(p => p.id === parseInt(t.productId)) || null}
                    onChange={(_, newValue) => {
                      handleTxnChange(idx, 'productId', newValue ? newValue.id.toString() : '');
                    }}
                    renderInput={params => <TextField {...params} label="Select Product" fullWidth size="small" sx={{ minWidth: 180 }} />}
                    disabled={products.length === 0}
                  />
                  </div>
                </TableCell>
                <TableCell>
                  <TextField name="quantity" value={t.quantity} onChange={e => handleTxnChange(idx, 'quantity', e.target.value)} size="small" type="number" sx={{ minWidth: 100 }} />
                </TableCell>
                <TableCell>
                  <TextField name="actualPrice" value={t.actualPrice} size="small" type="number" disabled sx={{ minWidth: 120 }} />
                </TableCell>
                <TableCell>
                  <TextField name="costPrice" value={toRoman(Math.ceil(parseFloat(t.costPrice) || 0))} size="small" type="text" disabled sx={{ minWidth: 120 }} />
                </TableCell>
                <TableCell>
                  <TextField name="transactionPrice" value={t.transactionPrice} onChange={e => handleTxnChange(idx, 'transactionPrice', e.target.value)} size="small" type="number" sx={{ minWidth: 120 }} />
                </TableCell>
                <TableCell>
                  <TextField name="amountPaid" value={t.amountPaid} onChange={e => handleTxnChange(idx, 'amountPaid', e.target.value)} size="small" type="number" sx={{ minWidth: 100 }} disabled={t.transactionType === 'return'} />
                </TableCell>
                <TableCell>
                  <TextField name="totalPrice" value={t.totalPrice} size="small" type="number" disabled sx={{ minWidth: 120 }} />
                </TableCell>
                <TableCell>
                  <Select name="transactionType" value={t.transactionType} onChange={e => handleTxnChange(idx, 'transactionType', e.target.value)} size="small" sx={{ minWidth: 100 }}>
                    <MenuItem value="return">Return</MenuItem>
                    <MenuItem value="sell">Sell</MenuItem>
                  </Select>
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => removeTxnRow(idx)} disabled={transactions.length === 1}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={10} align="center">
                <Button onClick={addTxnRow}>Add Row</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, mt: 2 }}>
        <Typography variant="h6">Total: {total.toFixed(2)}</Typography>
        <TextField label="Payment Amount" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} type="number" sx={{ width: '250px' }} />
        <Select
          value={discountPercent}
          onChange={e => setDiscountPercent(parseInt(e.target.value))}
          displayEmpty
          sx={{ width: '150px' }}
        >
          <MenuItem value={0}>0%</MenuItem>
          <MenuItem value={5}>5%</MenuItem>
          <MenuItem value={10}>10%</MenuItem>
          <MenuItem value={15}>15%</MenuItem>
          <MenuItem value={17}>17%</MenuItem>
          <MenuItem value={20}>20%</MenuItem>
          <MenuItem value={22}>22%</MenuItem>
          <MenuItem value={25}>25%</MenuItem>
        </Select>
        <TextField label="Discount Amount" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} type="number" sx={{ width: '250px' }} />
        <Typography variant="h6">Due: {adjustedTotal.toFixed(2)}</Typography>
      </Box>
      <Button variant="contained" color="primary" sx={{ mt: 2 }} onClick={handleSaveAndGenerateBill}>Save & Generate Bill</Button>
      {billGenerated && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Bill Preview</Typography>
          <div dangerouslySetInnerHTML={{ __html: billHtml }} />
          <Button variant="outlined" sx={{ mt: 1, mr: 2 }} onClick={handleDownloadHTML}>Download Bill</Button>
          <Button variant="outlined" sx={{ mt: 1, mr: 2 }} onClick={handleDownload57mm}>Download 57mm Bill</Button>
          <Button
            variant="outlined"
            startIcon={<WhatsAppIcon />}
            sx={{ mt: 1 }}
            onClick={() => {
              const message = `Your total bill at Jharkhand Steel on ${new Date().toLocaleDateString()} is ₹${lastBillData.grossTotal.toFixed(2)}. Due amount is ₹${lastBillData.total.toFixed(2)}.${lastBillData.total === 0 ? ' Fully paid.' : ''} Bill is attached.`;
              window.open(`https://wa.me/${lastBillData.customer.contact}?text=${encodeURIComponent(message)}`, '_blank');
            }}
            disabled={!lastBillData.customer.contact}
          >
            WhatsApp
          </Button>
        </Box>
      )}
      {snackbarQueue.length > 0 && (
        <Snackbar
          open={true}
          message={snackbarQueue[0]}
          autoHideDuration={null}
          disableWindowBlurListener
          disableClickAwayListener
          action={<IconButton size="small" aria-label="close" color="inherit" onClick={removeSnackbar}><CloseIcon fontSize="small" /></IconButton>}
        />
      )}
    </Box>
  );
}

export default BillingPage;
