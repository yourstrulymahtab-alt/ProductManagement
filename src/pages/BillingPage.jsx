import React, { useState, useEffect } from 'react';
import { getProducts, addTransaction, getUniqueCustomers, addLedgerAdjustment } from '../api/supabaseApi';
import { Box, Button, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Grid, Snackbar, Select, MenuItem, Autocomplete } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

function BillingPage() {
  const [customer, setCustomer] = useState({ name: '', contact: '' });
  const [transactions, setTransactions] = useState([
    { productId: '', quantity: '', actualPrice: '', transactionPrice: '', totalPrice: '', amountPaid: 0, transactionType: 'sell', costPrice: '' }
  ]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [billGenerated, setBillGenerated] = useState(false);
  const [billHtml, setBillHtml] = useState('');
  const [lastBill, setLastBill] = useState({ customer: { name: '', contact: '' }, transactions: [], total: 0, paidAmount: 0 });
  const [lastPayloadHash, setLastPayloadHash] = useState(null);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');

  useEffect(() => {
    getProducts().then(setProducts).catch(e => setSnackbar({ open: true, message: e.message }));
    getUniqueCustomers().then(setCustomers).catch(() => {});
  }, []);

  const handleCustomerChange = (e) => {
    setCustomer({ ...customer, [e.target.name]: e.target.value });
  };

  const handleTxnChange = (idx, field, value) => {
    const newTxns = [...transactions];
    newTxns[idx][field] = value;
    // If product or transactionType changes, update actualPrice, transactionPrice, and costPrice
    if (field === 'productId' || field === 'transactionType') {
      const product = products.find(p => p.id === parseInt(newTxns[idx].productId));
      if (product) {
        const actualPrice = newTxns[idx].transactionType === 'buy' ? product.costPrice : product.sellPrice;
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
    setTransactions(newTxns);
  };

  const addTxnRow = () => {
    setTransactions([...transactions, { productId: '', quantity: '', actualPrice: '', transactionPrice: '', totalPrice: '', amountPaid: 0, transactionType: 'sell', costPrice: '' }]);
  };

  const removeTxnRow = (idx) => {
    setTransactions(transactions.filter((_, i) => i !== idx));
  };

  const total = transactions.reduce((sum, t) => sum + parseFloat(t.totalPrice || 0), 0);
  const adjustedTotal = total - parseFloat(paymentAmount || 0) - parseFloat(discountAmount || 0);

  const handleSaveAndGenerateBill = async () => {
    // Check for duplicate submission within 2 minutes
    const currentTime = Date.now();
    const payload = { customer, transactions };
    const payloadString = JSON.stringify(payload);
    const payloadHash = btoa(payloadString); // Simple hash using base64

    if (lastPayloadHash === payloadHash && (currentTime - lastSubmissionTime) < 120000) { // 2 minutes = 120000 ms
      setSnackbar({ open: true, message: 'Duplicate submission detected. Please wait before submitting again.' });
      return;
    }

    if (!customer.name.trim() || !customer.contact.trim()) {
      setSnackbar({ open: true, message: 'Customer name and contact cannot be empty.' });
      return;
    }
    for (const t of transactions) {
      if (!t.productId || !t.quantity || !t.transactionPrice || t.amountPaid === undefined || !t.transactionType) {
        setSnackbar({ open: true, message: 'All transaction fields required.' });
        return;
      }
    }

    // Refresh products to get latest stock
    try {
      const updatedProducts = await getProducts();
      setProducts(updatedProducts);
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to refresh product stock: ' + e.message });
      return;
    }

    // Validate aggregated sell quantities against product stock
    const sellTotalsByProduct = {};
    for (const t of transactions) {
      if (t.transactionType === 'sell') {
        const pid = parseInt(t.productId);
        sellTotalsByProduct[pid] = (sellTotalsByProduct[pid] || 0) + parseFloat(t.quantity);
      }
    }
    for (const pidStr of Object.keys(sellTotalsByProduct)) {
      const pid = parseInt(pidStr);
      const prod = products.find(p => p.id === pid);
      if (!prod) {
        setSnackbar({ open: true, message: `Product not found for id ${pid}` });
        return;
      }
      if (prod.stock < sellTotalsByProduct[pid]) {
        setSnackbar({ open: true, message: `Insufficient stock for product ${prod.name}. Available: ${prod.stock}, requested: ${sellTotalsByProduct[pid]}` });
        return;
      }
    }

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
      if (parseFloat(discountAmount) > 0) {
        await addLedgerAdjustment({
          person_name: customer.name,
          contact: customer.contact,
          adjustment_amount: parseFloat(discountAmount),
          adjustment_date: new Date().toISOString(),
          reason: 'Discount',
        });
      }
      // Store the bill data before clearing inputs
      setLastBill({ customer: customer, transactions: transactions, total: adjustedTotal, paidAmount: parseFloat(paymentAmount) || 0, discountAmount: parseFloat(discountAmount) || 0 });
      // Update duplicate prevention state
      setLastPayloadHash(payloadHash);
      setLastSubmissionTime(currentTime);
      // Clear inputs after successful save
      setCustomer({ name: '', contact: '' });
      setTransactions([{ productId: '', quantity: '', actualPrice: '', transactionPrice: '', totalPrice: '', amountPaid: 0, transactionType: 'sell', costPrice: '' }]);
      setPaymentAmount('');
      setDiscountAmount('');
      setBillGenerated(true);
      setBillHtml(generateBillHtml(customer, transactions, total, parseFloat(paymentAmount) || 0, parseFloat(discountAmount) || 0));
      setSnackbar({ open: true, message: 'Bill generated and saved!' });
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  const generateBillHtml = (customer, transactions, total, paidAmount = 0, discountAmount = 0) => {
    const adjustedTotal = total - paidAmount - discountAmount;
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
          <p><b>Payment Amount:</b> ${paidAmount.toFixed(2)}</p>
          ${discountAmount > 0 ? `<p><b>Discount:</b> ${discountAmount.toFixed(2)}</p>` : ''}
          <p><b>Due:</b> ${adjustedTotal.toFixed(2)}</p>
          <p>Date: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;
  };

  const handleDownloadHTML = () => {
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
          <div class='bill-header'><b>Name:</b> ${lastBill.customer.name} &nbsp;&nbsp; <b>Contact:</b> ${lastBill.customer.contact}</div>
          <div class='bill-header'><b>Date:</b> ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Type</th></tr></thead>
            <tbody>
              ${lastBill.transactions.map((t, i) => {
                const prod = products.find(p => p.id == t.productId);
                return `<tr><td>${i + 1}</td><td>${prod ? prod.name : ''}</td><td>${t.quantity}</td><td>${t.transactionPrice}</td><td>${t.totalPrice}</td><td>${t.transactionType}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
          <br>
          <div class='bill-header'><b>Payment Amount:</b> ${lastBill.paidAmount.toFixed(2)}</div>
          ${lastBill.discountAmount > 0 ? `<div class='bill-header'><b>Discount:</b> ${lastBill.discountAmount.toFixed(2)}</div>` : ''}
          <div class='bill-footer'>Due: ${lastBill.total.toFixed(2)}</div>
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
    a.download = `bill_${lastBill.customer.name}_${formattedDate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to get contact by name
  const getContactByName = (name) => {
    const found = customers.find(c => c.person_name === name);
    return found ? found.contact : '';
  };
  // Helper to get name by contact
  const getNameByContact = (contact) => {
    const found = customers.find(c => c.contact === contact);
    return found ? found.person_name : '';
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
              <TableCell>Cost Price</TableCell>
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
                  <TextField name="costPrice" value={t.costPrice} size="small" type="number" disabled sx={{ minWidth: 120 }} />
                </TableCell>
                <TableCell>
                  <TextField name="transactionPrice" value={t.transactionPrice} onChange={e => handleTxnChange(idx, 'transactionPrice', e.target.value)} size="small" type="number" sx={{ minWidth: 120 }} onFocus={e => {
                    if (!t.transactionPrice && t.productId && t.transactionType) {
                      const product = products.find(p => p.id === parseInt(t.productId));
                      if (product) {
                        const actualPrice = t.transactionType === 'buy' ? product.costPrice : product.sellPrice;
                        handleTxnChange(idx, 'transactionPrice', actualPrice);
                      }
                    }
                  }} />
                </TableCell>
                <TableCell>
                  <TextField name="amountPaid" value={t.amountPaid} onChange={e => handleTxnChange(idx, 'amountPaid', e.target.value)} size="small" type="number" sx={{ minWidth: 100 }} />
                </TableCell>
                <TableCell>
                  <TextField name="totalPrice" value={t.totalPrice} size="small" type="number" disabled sx={{ minWidth: 120 }} />
                </TableCell>
                <TableCell>
                  <Select name="transactionType" value={t.transactionType} onChange={e => handleTxnChange(idx, 'transactionType', e.target.value)} size="small" sx={{ minWidth: 100 }}>
                    <MenuItem value="buy">Buy</MenuItem>
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
        <TextField label="Payment Amount" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} type="number" fullWidth />
        <TextField label="Discount Amount" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} type="number" fullWidth />
        <Typography variant="h6">Due: {adjustedTotal.toFixed(2)}</Typography>
      </Box>
      <Button variant="contained" color="primary" sx={{ mt: 2 }} onClick={handleSaveAndGenerateBill}>Save & Generate Bill</Button>
      {billGenerated && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Bill Preview</Typography>
          <div dangerouslySetInnerHTML={{ __html: billHtml }} />
          <Button variant="outlined" sx={{ mt: 1, mr: 2 }} onClick={handleDownloadHTML}>Download Bill</Button>
          <Button
            variant="outlined"
            startIcon={<WhatsAppIcon />}
            sx={{ mt: 1 }}
            onClick={() => {
              const message = `Your total bill at Jharkhand Steel on ${new Date().toLocaleDateString()} is ₹${lastBill.total.toFixed(2)}. Bill is attached.`;
              window.open(`https://wa.me/${lastBill.customer.contact}?text=${encodeURIComponent(message)}`, '_blank');
            }}
            disabled={!lastBill.customer.contact}
          >
            WhatsApp
          </Button>
        </Box>
      )}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} message={snackbar.message} />
    </Box>
  );
}

export default BillingPage;