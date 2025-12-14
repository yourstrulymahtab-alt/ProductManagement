// ...existing code...

import React, { useEffect, useState } from 'react';
import { getProducts, addProduct, deleteProduct } from '../api/supabaseApi';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Snackbar, Grid, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchProducts = async () => {
    try {
      setProducts(await getProducts());
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };
  useEffect(() => { fetchProducts(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.price || !form.stock) {
      setSnackbar({ open: true, message: 'Name, Price, and Stock are required.' });
      return;
    }
    // Check for duplicate product name (case-insensitive)
    if (products.some(p => p.name.toLowerCase() === form.name.trim().toLowerCase())) {
      setSnackbar({ open: true, message: 'Product name already exists.' });
      return;
    }
    try {
      await addProduct({ ...form, price: parseFloat(form.price), stock: parseInt(form.stock) });
      setForm({ name: '', description: '', price: '', stock: '' });
      setOpen(false);
      fetchProducts();
      setSnackbar({ open: true, message: 'Product added.' });
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProduct(id);
      fetchProducts();
      setSnackbar({ open: true, message: 'Product deleted.' });
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: isMobile ? 1 : 3 }}>
      <Grid container alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Manage Products</Typography>
        </Grid>
        <Grid item xs={12} sm={6} textAlign={isMobile ? 'left' : 'right'}>
          <Button variant="contained" onClick={() => setOpen(true)} size={isMobile ? 'small' : 'medium'}>Add Product</Button>
        </Grid>
      </Grid>
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size={isMobile ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>{p.id}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.price}</TableCell>
                <TableCell>{p.stock}</TableCell>
                <TableCell align="center">
                  <IconButton onClick={() => handleDelete(p.id)} size={isMobile ? 'small' : 'medium'} color="error"><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={open} onClose={() => setOpen(false)} fullScreen={isMobile} maxWidth="xs" fullWidth>
        <DialogTitle>Add Product</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField label="Name" fullWidth margin="dense" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" fullWidth margin="dense" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Price" type="number" fullWidth margin="dense" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Stock" type="number" fullWidth margin="dense" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
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

export default ProductsPage;
