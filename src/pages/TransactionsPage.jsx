// ...existing code...

import React, { useEffect, useState } from 'react';
import { getProducts, getTransactions, addTransaction, clearTransactions } from '../api/supabaseApi';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Snackbar, IconButton, Grid, useMediaQuery, Select, MenuItem } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';

function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ productId: '', quantity: '', price: '', transactionType: 'buy', personName: '', contact: '' });
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
    if (!form.productId || !form.quantity || !form.price || !form.transactionType || !form.personName || !form.contact) {
      setSnackbar({ open: true, message: 'All fields are required.' });
      return;
    }
    const product = products.find(p => p.id === parseInt(form.productId));
    if (!product) {
      setSnackbar({ open: true, message: 'Product not found.' });
      return;
    }
    if (form.transactionType === 'sell' && product.stock < parseInt(form.quantity)) {
      setSnackbar({ open: true, message: 'Insufficient stock.' });
      return;
    }
    try {
      await addTransaction({
        product_id: parseInt(form.productId),
        quantity: parseInt(form.quantity),
        price: parseFloat(form.price),
        transaction_type: form.transactionType,
        person_name: form.personName,
        contact: form.contact,
      });
      setForm({ productId: '', quantity: '', price: '', transactionType: 'buy', personName: '', contact: '' });
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
              <TableCell>Price</TableCell>
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
                <TableCell>{t.price}</TableCell>
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
              <Select
                fullWidth
                value={form.productId}
                onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                displayEmpty
                sx={{ mt: 1 }}
                disabled={products.length === 0}
                renderValue={selected => {
                  if (!selected) return 'Select Product';
                  const prod = products.find(p => p.id === parseInt(selected));
                  return prod ? prod.name : 'Select Product';
                }}
              >
                <MenuItem value="" disabled>Select Product</MenuItem>
                {products.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Quantity" type="number" fullWidth margin="dense" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Price" type="number" fullWidth margin="dense" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Select fullWidth value={form.transactionType} onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))} sx={{ mt: 1 }}>
                <MenuItem value="buy">Buy</MenuItem>
                <MenuItem value="sell">Sell</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12} sm={6} />
            <Grid item xs={12} sm={6}>
              <TextField label="Buyer/Seller Name" fullWidth margin="dense" value={form.personName} onChange={e => setForm(f => ({ ...f, personName: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
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
