// ...existing code...

import React, { useEffect, useState } from 'react';
import { getProducts, getTransactions, addTransaction, clearTransactions } from '../api/supabaseApi';
import { PRODUCT_SALES_TYPE } from '../api/productModel';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Snackbar, IconButton, Grid, useMediaQuery, Select, MenuItem, Autocomplete } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';

function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    quantity: '',
    transactionPrice: '',
    amountPaid: '',
    transactionType: 'buy',
    personName: '',
    contact: '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchData = async () => {
    try {
      const txns = await getTransactions();
      setTransactions(txns.slice(0, 50));
      setProducts(await getProducts());
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };
  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!form.productId || !form.quantity || !form.transactionPrice || !form.amountPaid || !form.transactionType || !form.personName || !form.contact) {
      setSnackbar({ open: true, message: 'All fields are required.' });
      return;
    }
    const product = products.find(p => p.id === parseInt(form.productId));
    if (!product) {
      setSnackbar({ open: true, message: 'Product not found.' });
      return;
    }
    if (form.transactionType === 'sell' && product.stock < parseFloat(form.quantity)) {
      setSnackbar({ open: true, message: 'Insufficient stock.' });
      return;
    }
    // Calculate actual price (from product cp/sp)
    const actualPrice = form.transactionType === 'buy' ? product.costPrice : product.sellPrice;
    const totalPrice = parseFloat(form.transactionPrice) * parseFloat(form.quantity);
    try {
      await addTransaction({
        product_id: parseInt(form.productId),
        quantity: parseFloat(form.quantity),
        actualPrice: parseFloat(actualPrice),
        transactionPrice: parseFloat(form.transactionPrice),
        totalPrice,
        amountPaid: parseFloat(form.amountPaid),
        transaction_type: form.transactionType,
        person_name: form.personName,
        contact: form.contact,
      });
      setForm({ productId: '', quantity: '', transactionPrice: '', amountPaid: '', transactionType: 'buy', personName: '', contact: '' });
      setOpen(false);
      fetchData();
      setSnackbar({ open: true, message: 'Transaction added.' });
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  const handleClear = async () => {
    try {
      await clearTransactions();
      fetchData();
      setSnackbar({ open: true, message: 'All transactions cleared.' });
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: isMobile ? 1 : 3 }}>
      <Grid container alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Manage Transactions</Typography>
        </Grid>
        <Grid item xs={12} sm={6} textAlign={isMobile ? 'left' : 'right'}>
          <Button variant="contained" onClick={() => setOpen(true)} size={isMobile ? 'small' : 'medium'}>Add Transaction</Button>
        </Grid>
      </Grid>
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size={isMobile ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Product Name</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Actual Price</TableCell>
              <TableCell>Transaction Price</TableCell>
              <TableCell>Total Price</TableCell>
              <TableCell>Amount Paid</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Person</TableCell>
              <TableCell>Contact</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.id}</TableCell>
                <TableCell>{t.productName}</TableCell>
                <TableCell>{t.quantity}</TableCell>
                <TableCell>{t.actualPrice ?? t.actual_price ?? ''}</TableCell>
                <TableCell>{t.transactionPrice ?? t.transaction_price ?? ''}</TableCell>
                <TableCell>{t.totalPrice ?? t.total_price ?? ''}</TableCell>
                <TableCell>{t.amountPaid ?? t.amount_paid ?? ''}</TableCell>
                <TableCell>{t.transactionType || t.transaction_type}</TableCell>
                <TableCell>{t.transactionDate || t.transaction_date}</TableCell>
                <TableCell>{t.personName || t.person_name}</TableCell>
                <TableCell>{t.contact}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={open} onClose={() => setOpen(false)} fullScreen={isMobile} maxWidth="xs" fullWidth>
        <DialogTitle>Add Transaction</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Select fullWidth value={form.transactionType} onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))} sx={{ mt: 1 }}>
                <MenuItem value="buy">Buy</MenuItem>
                <MenuItem value="sell">Sell</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                fullWidth
                options={products}
                getOptionLabel={(option) => option.name || ''}
                value={products.find(p => p.id === parseInt(form.productId)) || null}
                onChange={(event, newValue) => {
                  setForm(f => {
                    const product = newValue;
                    let actualPrice = '';
                    if (product && form.transactionType) {
                      actualPrice = form.transactionType === 'buy' ? product.costPrice : product.sellPrice;
                    }
                    return {
                      ...f,
                      productId: product ? product.id.toString() : '',
                      transactionPrice: actualPrice !== '' ? actualPrice : f.transactionPrice,
                    };
                  });
                }}
                renderInput={(params) => <TextField {...params} label="Select Product" sx={{ mt: 1, '& .MuiInputBase-root': { height: 56 } }} />}
                disabled={products.length === 0}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Quantity" type="number" fullWidth margin="dense" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Transaction Price (per unit/kg)"
                type="number"
                fullWidth
                margin="dense"
                value={form.transactionPrice}
                onChange={e => setForm(f => ({ ...f, transactionPrice: e.target.value }))}
                onFocus={e => {
                  // Set default value if empty and product/type selected
                  if (!form.transactionPrice && form.productId && form.transactionType) {
                    const product = products.find(p => p.id === parseInt(form.productId));
                    if (product) {
                      const actualPrice = form.transactionType === 'buy' ? product.costPrice : product.sellPrice;
                      setForm(f => ({ ...f, transactionPrice: actualPrice }));
                    }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Amount Paid" type="number" fullWidth margin="dense" value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Buyer/Seller Name" fullWidth margin="dense" value={form.personName} onChange={e => setForm(f => ({ ...f, personName: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Contact Number" fullWidth margin="dense" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="secondary">Cancel</Button>
          <Button onClick={handleAdd} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
  );
}

export default TransactionsPage;
