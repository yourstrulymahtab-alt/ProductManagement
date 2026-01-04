// ...existing code...

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getProducts, getTransactions, addTransaction, reverseTransaction } from '../api/supabaseApi';
import { PRODUCT_SALES_TYPE } from '../api/productModel';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Snackbar, IconButton, Grid, useMediaQuery, Select, MenuItem, Autocomplete } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';

function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [form, setForm] = useState({
    productId: '',
    quantity: '',
    transactionPrice: '',
    amountPaid: '',
    transactionType: 'return',
    personName: '',
    contact: '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [pendingFilters, setPendingFilters] = useState({
    personContact: '',
    date: null,
    reversed: '',
    productName: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    personContact: '',
    date: null,
    reversed: '',
    productName: '',
  });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Helper function to convert UTC timestamp to IST
  const convertToIST = useCallback((utcDateString) => {
    if (!utcDateString) return '';
    const utcDate = new Date(utcDateString);
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istDate = new Date(utcDate.getTime() + istOffset);
    return istDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const txns = await getTransactions();
      setTransactions(txns.slice(0, 50));
      setProducts(await getProducts());
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const personContactOptions = useMemo(() => {
    const unique = new Set();
    transactions.forEach(t => {
      const name = t.personName || t.person_name || '';
      const contact = t.contact || '';
      if (name || contact) {
        unique.add(`${name} - ${contact}`);
      }
    });
    return Array.from(unique).sort();
  }, [transactions]);

  const productNameOptions = useMemo(() => {
    const unique = new Set();
    transactions.forEach(t => {
      if (t.productName) unique.add(t.productName);
    });
    return Array.from(unique).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const personContact = `${t.personName || t.person_name || ''} - ${t.contact || ''}`;
      const personMatch = !appliedFilters.personContact || personContact.toLowerCase().includes(appliedFilters.personContact.toLowerCase());
      const dateMatch = !appliedFilters.date || convertToIST(t.transactionDate || t.transaction_date).includes(appliedFilters.date.toLocaleDateString('en-IN'));
      const reversedMatch = appliedFilters.reversed === '' || (appliedFilters.reversed === 'true' ? t.reversed : !t.reversed);
      const productMatch = !appliedFilters.productName || (t.productName || '').toLowerCase().includes(appliedFilters.productName.toLowerCase());
      return personMatch && dateMatch && reversedMatch && productMatch;
    });
  }, [transactions, appliedFilters, convertToIST]);

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
    const actualPrice = form.transactionType === 'return' ? product.costPrice : product.sellPrice;
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
      setForm({ productId: '', quantity: '', transactionPrice: '', amountPaid: '', transactionType: 'return', personName: '', contact: '' });
      setOpen(false);
      fetchData();
      setSnackbar({ open: true, message: 'Transaction added.' });
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };



  const handleReverseClick = (txn) => {
    setSelectedTxn(txn);
    setConfirmOpen(true);
  };

  const handleConfirmReverse = async () => {
    if (!selectedTxn) return;
    try {
      await reverseTransaction(selectedTxn.id);
      setSnackbar({ open: true, message: 'Transaction reversed.' });
      setConfirmOpen(false);
      setSelectedTxn(null);
      fetchData();
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ mx: 'auto', p: isMobile ? 1 : 3 }}>
        <Grid container alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Manage Transactions</Typography>
          </Grid>
          <Grid item xs={12} sm={6} textAlign={isMobile ? 'left' : 'right'}>
            <Button variant="contained" onClick={() => setOpen(true)} size={isMobile ? 'small' : 'medium'}>Add Transaction</Button>
          </Grid>
        </Grid>
        <Grid container spacing={2} sx={{ mb: 2 }} justifyContent="space-between">
          <Grid item xs={12} sm={12} md={9}>
            <div style={{ width: '250px' }}>
            <Autocomplete
              fullWidth
              size="small"
              options={personContactOptions}
              value={pendingFilters.personContact}
              onChange={(event, newValue) => setPendingFilters(f => ({ ...f, personContact: newValue || '' }))}
              renderInput={(params) => <TextField {...params} label="Person - Contact" />}
              freeSolo
            />
            </div>
          </Grid>
          <Grid item xs={12} sm={6} md={0}>
            <DatePicker
              label="Date"
              value={pendingFilters.date}
              onChange={(newValue) => setPendingFilters(f => ({ ...f, date: newValue }))}
              renderInput={(params) => <TextField {...params} fullWidth size="small" />}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={0}>
            <div style={{ width: '100px' }}>
            <Select
              fullWidth
              size="small"
              value={pendingFilters.reversed}
              onChange={e => setPendingFilters(f => ({ ...f, reversed: e.target.value }))}
              displayEmpty
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Reversed</MenuItem>
              <MenuItem value="false">Not Reversed</MenuItem>
            </Select>
            </div>
          </Grid>
          <Grid item xs={12} sm={12} md={9}>
            <div style={{ width: '250px' }}>
            <Autocomplete
              fullWidth
              size="small"
              options={productNameOptions}
              value={pendingFilters.productName}
              onChange={(event, newValue) => setPendingFilters(f => ({ ...f, productName: newValue || '' }))}
              renderInput={(params) => <TextField {...params} label="Product Name" />}
              freeSolo
            />
            </div>
          </Grid>
        </Grid>
        <Grid container spacing={2} sx={{ mb: 2 }} justifyContent="center">
          <Grid item xs={12} sm={6} md={2}>
            <Button variant="contained" onClick={() => setAppliedFilters(pendingFilters)}>
              Apply Filters
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button variant="outlined" onClick={() => {
              const cleared = { personContact: '', date: null, reversed: '', productName: '' };
              setPendingFilters(cleared);
              setAppliedFilters(cleared);
            }}>
              Clear Filters
            </Button>
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
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTransactions.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{t.id}</TableCell>
                <TableCell>{t.productName}</TableCell>
                <TableCell>{t.quantity}</TableCell>
                <TableCell>{t.actualPrice ?? t.actual_price ?? ''}</TableCell>
                <TableCell>{t.transactionPrice ?? t.transaction_price ?? ''}</TableCell>
                <TableCell>{t.totalPrice ?? t.total_price ?? ''}</TableCell>
                <TableCell>{t.amountPaid ?? t.amount_paid ?? ''}</TableCell>
                <TableCell>{t.transactionType || t.transaction_type}{t.reversed ? ' (reversed)' : ''}</TableCell>
                <TableCell>{convertToIST(t.transactionDate || t.transaction_date)}</TableCell>
                <TableCell>{t.personName || t.person_name}</TableCell>
                <TableCell>{t.contact}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleReverseClick(t)} disabled={t.reversed} title="Reverse transaction">
                    <ReplayIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullScreen={isMobile} maxWidth="md" fullWidth>
        <DialogTitle>Add Transaction</DialogTitle>
        <DialogContent>
          <Grid container
            spacing={2}
            direction="column" 
            >
            <Grid item xs={12} sm={6}>
              <Select fullWidth value={form.transactionType} onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))} sx={{ mt: 1 }}>
                <MenuItem value="return">Return</MenuItem>
                <MenuItem value="sell">Sell</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
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
                      actualPrice = form.transactionType === 'return' ? product.sellPrice : product.sellPrice;
                    }
                    return {
                      ...f,
                      productId: product ? product.id.toString() : '',
                      transactionPrice: actualPrice !== '' ? actualPrice : f.transactionPrice,
                    };
                  });
                }}
                renderInput={(params) => <TextField {...params} label="Select Product" fullWidth sx={{ mt: 1, '& .MuiInputBase-root': { height: 56 } }} />}
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
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Amount Paid" type="number" fullWidth margin="dense" value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} disabled={form.transactionType === 'return'} />
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

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Reverse</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to reverse the selected transaction?</Typography>
          {selectedTxn && (
            <Box sx={{ mt: 2 }}>
              <Typography><strong>Transaction ID:</strong> {selectedTxn.id}</Typography>
              <Typography><strong>Product:</strong> {selectedTxn.productName}</Typography>
              <Typography><strong>Quantity:</strong> {selectedTxn.quantity}</Typography>
              <Typography><strong>Type:</strong> {selectedTxn.transactionType || selectedTxn.transaction_type}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmReverse} variant="contained" color="warning">Reverse</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
    </LocalizationProvider>
  );
}

export default TransactionsPage;
