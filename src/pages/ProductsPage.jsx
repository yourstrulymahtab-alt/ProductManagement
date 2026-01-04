// ...existing code...

import React, { useEffect, useState } from 'react';
import { getProducts, addProduct, deleteProduct } from '../api/supabaseApi';
import { PRODUCT_SALES_TYPE } from '../api/productModel';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Snackbar, Grid, useMediaQuery, Autocomplete } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [filterName, setFilterName] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    salesType: PRODUCT_SALES_TYPE.QUANTITY,
    costPrice: '',
    sellPrice: '',
    stock: '',
  });
  const [editId, setEditId] = useState(null);
  const [openAddStock, setOpenAddStock] = useState(false);
  const [addStockId, setAddStockId] = useState(null);
  const [addStockForm, setAddStockForm] = useState({ quantity: '' });
  const [confirmEdit, setConfirmEdit] = useState({ open: false, product: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const getDisplayName = (product) => `${product.name}${product.description ? ` (${product.description})` : ''}`;

  const fetchProducts = async () => {
    try {
      const prods = await getProducts();
      setProducts(prods);
      setFilteredProducts(prods);
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (filterName) {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(filterName.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [products, filterName]);

  const handleAddOrEdit = async () => {
    if (!form.name || !form.costPrice || !form.sellPrice || !form.stock) {
      setSnackbar({ open: true, message: 'Name, Cost Price, Sell Price, and Stock are required.' });
      return;
    }
    // Check for duplicate product name (case-insensitive) when adding
    if (!editId && products.some(p => p.name.toLowerCase() === form.name.trim().toLowerCase())) {
      setSnackbar({ open: true, message: 'Product name already exists.' });
      return;
    }
    try {
      const productData = {
        ...form,
        costPrice: parseFloat(form.costPrice),
        sellPrice: parseFloat(form.sellPrice),
        stock: parseFloat(form.stock),
      };
      if (editId) {
        // Update product
        await addProduct({ ...productData, id: editId, isEdit: true });
        setSnackbar({ open: true, message: 'Product updated.' });
      } else {
        await addProduct(productData);
        setSnackbar({ open: true, message: 'Product added.' });
      }
      setForm({ name: '', description: '', salesType: PRODUCT_SALES_TYPE.QUANTITY, costPrice: '', sellPrice: '', stock: '' });
      setEditId(null);
      setOpen(false);
      fetchProducts();
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

  const handleAddStock = async () => {
    if (!addStockForm.quantity || parseFloat(addStockForm.quantity) <= 0) {
      setSnackbar({ open: true, message: 'Please enter a valid quantity to add.' });
      return;
    }
    try {
      const product = products.find(p => p.id === addStockId);
      if (!product) {
        setSnackbar({ open: true, message: 'Product not found.' });
        return;
      }
      const newStock = product.stock + parseFloat(addStockForm.quantity);
      await addProduct({ ...product, stock: newStock, id: addStockId, isEdit: true });
      setSnackbar({ open: true, message: 'Stock added successfully.' });
      setAddStockForm({ quantity: '' });
      setAddStockId(null);
      setOpenAddStock(false);
      fetchProducts();
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
          <Button variant="contained" onClick={() => { setOpen(true); setEditId(null); setForm({ name: '', description: '', salesType: PRODUCT_SALES_TYPE.QUANTITY, costPrice: '', sellPrice: '', stock: '' }); }} size={isMobile ? 'small' : 'medium'}>Add Product</Button>
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6}>
          <div style={{ width: '300px' }}>
          <Autocomplete
            freeSolo
            options={products.map(p => p.name)}
            value={filterName}
            onChange={(_, newValue) => setFilterName(newValue)}
            onInputChange={(_, newInputValue) => {
              setFilterName(newInputValue || null);
            }}
            renderInput={params => (
              <TextField {...params} label="Filter by Product Name" fullWidth size="small" />
            )}
          />
          </div>
        </Grid>
      </Grid>
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size={isMobile ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Sales Type</TableCell>
              <TableCell>Cost Price</TableCell>
              <TableCell>Sell Price</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredProducts.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>{p.id}</TableCell>
                <TableCell>{getDisplayName(p)}</TableCell>
                <TableCell>{p.salesType === PRODUCT_SALES_TYPE.WEIGHT ? 'Weight (kg)' : 'Quantity'}</TableCell>
                <TableCell>{p.costPrice}</TableCell>
                <TableCell>{p.sellPrice}</TableCell>
                <TableCell>{p.stock}</TableCell>
                <TableCell align="center">
                  <Button size={isMobile ? 'small' : 'medium'} onClick={() => setConfirmEdit({ open: true, product: p })}>Edit</Button>
                  <Button size={isMobile ? 'small' : 'medium'} onClick={() => {
                    setOpenAddStock(true);
                    setAddStockId(p.id);
                    setAddStockForm({ quantity: '' });
                  }}>Add Stock</Button>
                  <IconButton onClick={() => handleDelete(p.id)} size={isMobile ? 'small' : 'medium'} color="error"><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={open} onClose={() => { setOpen(false); setEditId(null); }} fullScreen={isMobile} maxWidth="xs" fullWidth>
        <DialogTitle>{editId ? 'Edit Product' : 'Add Product'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField label="Name" fullWidth margin="dense" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={!!editId} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" fullWidth margin="dense" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Sales Type"
                fullWidth
                margin="dense"
                SelectProps={{ native: true }}
                value={form.salesType}
                onChange={e => setForm(f => ({ ...f, salesType: e.target.value }))}
              >
                <option value={PRODUCT_SALES_TYPE.QUANTITY}>Quantity (per unit)</option>
                <option value={PRODUCT_SALES_TYPE.WEIGHT}>Weight (per kg)</option>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label={form.salesType === PRODUCT_SALES_TYPE.WEIGHT ? 'Cost Price (per kg)' : 'Cost Price (per unit)'} type="number" fullWidth margin="dense" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label={form.salesType === PRODUCT_SALES_TYPE.WEIGHT ? 'Sell Price (per kg)' : 'Sell Price (per unit)'} type="number" fullWidth margin="dense" value={form.sellPrice} onChange={e => setForm(f => ({ ...f, sellPrice: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField label={form.salesType === PRODUCT_SALES_TYPE.WEIGHT ? 'Stock (kg)' : 'Stock (units)'} type="number" fullWidth margin="dense" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setEditId(null); }} color="secondary">Cancel</Button>
          <Button onClick={handleAddOrEdit} variant="contained">{editId ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openAddStock} onClose={() => { setOpenAddStock(false); setAddStockId(null); }} fullScreen={isMobile} maxWidth="xs" fullWidth>
        <DialogTitle>Add Stock</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Quantity to Add"
                type="number"
                fullWidth
                margin="dense"
                value={addStockForm.quantity}
                onChange={e => setAddStockForm(f => ({ ...f, quantity: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenAddStock(false); setAddStockId(null); }} color="secondary">Cancel</Button>
          <Button onClick={handleAddStock} variant="contained">Add Stock</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmEdit.open} onClose={() => setConfirmEdit({ open: false, product: null })}>
        <DialogTitle>Confirm Edit</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to edit the product "{confirmEdit.product?.name}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmEdit({ open: false, product: null })} color="secondary">Cancel</Button>
          <Button onClick={() => {
            if (confirmEdit.product) {
              setOpen(true);
              setEditId(confirmEdit.product.id);
              setForm({
                name: confirmEdit.product.name,
                description: confirmEdit.product.description || '',
                salesType: confirmEdit.product.salesType || PRODUCT_SALES_TYPE.QUANTITY,
                costPrice: confirmEdit.product.costPrice,
                sellPrice: confirmEdit.product.sellPrice,
                stock: confirmEdit.product.stock,
              });
              setConfirmEdit({ open: false, product: null });
            }
          }} variant="contained">Yes, Edit</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmDelete.open} onClose={() => setConfirmDelete({ open: false, id: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this product? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete({ open: false, id: null })} color="secondary">Cancel</Button>
          <Button onClick={() => {
            if (confirmDelete.id) {
              handleDelete(confirmDelete.id);
              setConfirmDelete({ open: false, id: null });
            }
          }} variant="contained" color="error">Yes, Delete</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
  );
}

export default ProductsPage;
