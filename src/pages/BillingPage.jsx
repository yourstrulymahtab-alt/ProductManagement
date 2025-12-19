import React, { useState, useEffect } from 'react';
import { getProducts, addTransaction, getUniqueCustomers } from '../api/supabaseApi';
import { Box, Button, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Grid, Snackbar, Select, MenuItem, Autocomplete } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

function BillingPage() {
  const [customer, setCustomer] = useState({ name: '', contact: '' });
  const [transactions, setTransactions] = useState([
    { productId: '', quantity: '', actualPrice: '', transactionPrice: '', totalPrice: '', amountPaid: 0, transactionType: 'sell' }
  ]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [billGenerated, setBillGenerated] = useState(false);
  const [billHtml, setBillHtml] = useState('');

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
    // If product or transactionType changes, update actualPrice and transactionPrice
    if (field === 'productId' || field === 'transactionType') {
      const product = products.find(p => p.id === parseInt(newTxns[idx].productId));
      if (product) {
        const actualPrice = newTxns[idx].transactionType === 'buy' ? product.costPrice : product.sellPrice;
        newTxns[idx].actualPrice = actualPrice;
        newTxns[idx].transactionPrice = actualPrice;
      } else {
        newTxns[idx].actualPrice = '';
        newTxns[idx].transactionPrice = '';
      }
    }
    // If quantity or transactionPrice changes, update totalPrice
    if (field === 'quantity' || field === 'transactionPrice') {
      newTxns[idx].totalPrice = (parseFloat(newTxns[idx].transactionPrice || 0) * parseFloat(newTxns[idx].quantity || 0)).toFixed(2);
    }
    setTransactions(newTxns);
  };

  const addTxnRow = () => {
    setTransactions([...transactions, { productId: '', quantity: '', actualPrice: '', transactionPrice: '', totalPrice: '', amountPaid: 0, transactionType: 'sell' }]);
  };

  const removeTxnRow = (idx) => {
    setTransactions(transactions.filter((_, i) => i !== idx));
  };

  const total = transactions.reduce((sum, t) => sum + parseFloat(t.totalPrice || 0), 0);

  const handleSaveAndGenerateBill = async () => {
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
      setBillGenerated(true);
      setBillHtml(generateBillHtml());
      setSnackbar({ open: true, message: 'Bill generated and saved!' });
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  const generateBillHtml = () => {
    let rows = transactions.map((t, i) => {
      const prod = products.find(p => p.id == t.productId);
      return `<tr><td>${i + 1}</td><td>${prod ? prod.name : ''}</td><td>${t.quantity}</td><td>${t.actualPrice}</td><td>${t.transactionPrice}</td><td>${t.amountPaid}</td><td>${t.totalPrice}</td><td>${t.transactionType}</td></tr>`;
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
            <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Actual Price</th><th>Txn Price</th><th>Paid</th><th>Total</th><th>Type</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <h3>Total: ${total.toFixed(2)}</h3>
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
          <div class='bill-header'><b>Name:</b> ${customer.name} &nbsp;&nbsp; <b>Contact:</b> ${customer.contact}</div>
          <div class='bill-header'><b>Date:</b> ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Actual Price</th><th>Txn Price</th><th>Paid</th><th>Total</th><th>Type</th></tr></thead>
            <tbody>
              ${transactions.map((t, i) => {
                const prod = products.find(p => p.id == t.productId);
                return `<tr><td>${i + 1}</td><td>${prod ? prod.name : ''}</td><td>${t.quantity}</td><td>${t.actualPrice}</td><td>${t.transactionPrice}</td><td>${t.amountPaid}</td><td>${t.totalPrice}</td><td>${t.transactionType}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
          <div class='bill-footer'>Total: ${total.toFixed(2)}</div>
        </div>
      </div>
    </body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill_${customer.name}_${Date.now()}.html`;
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
              <TextField {...params} label="Customer Name" fullWidth margin="normal" required
                sx={{ minWidth: 420, maxWidth: 600 }}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
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
              <TextField {...params} label="Contact" fullWidth margin="normal" required
                sx={{ minWidth: 420, maxWidth: 600 }}
              />
            )}
          />
        </Grid>
      </Grid>
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Actual Price</TableCell>
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
                </TableCell>
                <TableCell>
                  <TextField name="quantity" value={t.quantity} onChange={e => handleTxnChange(idx, 'quantity', e.target.value)} size="small" type="number" sx={{ minWidth: 100 }} />
                </TableCell>
                <TableCell>
                  <TextField name="actualPrice" value={t.actualPrice} size="small" type="number" disabled sx={{ minWidth: 120 }} />
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
              <TableCell colSpan={9} align="center">
                <Button onClick={addTxnRow}>Add Row</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="h6" sx={{ mt: 2 }}>Total: {total.toFixed(2)}</Typography>
      <Button variant="contained" color="primary" sx={{ mt: 2 }} onClick={handleSaveAndGenerateBill}>Save & Generate Bill</Button>
      {billGenerated && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Bill Preview</Typography>
          <div dangerouslySetInnerHTML={{ __html: billHtml }} />
          <Button variant="outlined" sx={{ mt: 1, mr: 2 }} onClick={handleDownloadHTML}>Download Bill</Button>
        </Box>
      )}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} message={snackbar.message} />
    </Box>
  );
}

export default BillingPage;

