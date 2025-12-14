// ...existing code...

import React, { useEffect, useState } from 'react';
import { getProducts, getTransactions } from '../api/supabaseApi';
import { Box, Typography, Paper, List, ListItem, ListItemText, Button, Grid, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

function StockPage() {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchData = async () => {
    try {
      setProducts(await getProducts());
      // Only use last 50 transactions for analysis
      const txns = await getTransactions();
      setTransactions(txns.slice(0, 50));
    } catch (e) {
      // Optionally show error
    }
  };
  useEffect(() => { fetchData(); }, []);

  // Low and High Stock
  const lowStock = products.filter(p => p.stock < 10);
  const highStock = products.filter(p => p.stock > 50);

  // Most Sold Product by Quantity and Price
  const getMostSold = (days, byPrice = false) => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    // Support both camelCase and snake_case from Supabase
    const filtered = transactions.filter(t => (t.transaction_type === 'sell' || t.transactionType === 'sell') && new Date(t.transaction_date || t.transactionDate) >= since);
    const stats = {};
    filtered.forEach(t => {
      // Try to get product name from joined field or fallback to product_id
      const name = t.productName || t.product_name || t.product_id;
      if (!stats[name]) stats[name] = { qty: 0, price: 0 };
      stats[name].qty += t.quantity;
      stats[name].price += t.quantity * t.price;
    });
    let max = null;
    for (const [name, s] of Object.entries(stats)) {
      if (!max || (byPrice ? s.price > max.val : s.qty > max.val)) {
        max = { name, val: byPrice ? s.price : s.qty };
      }
    }
    return max ? `${max.name} (${byPrice ? '₹' + max.val.toFixed(2) : max.val + ' units'})` : 'N/A';
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: isMobile ? 1 : 3 }}>
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} sm={6}>
          <Button variant="outlined" onClick={fetchData} sx={{ mb: 2 }} fullWidth={isMobile}>Refresh Stock Analysis</Button>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant={isMobile ? 'subtitle1' : 'h6'}>Low Stock Products:</Typography>
            <List dense>{lowStock.length ? lowStock.map(p => <ListItem key={p.id}><ListItemText primary={p.name} /></ListItem>) : <ListItem><ListItemText primary="N/A" /></ListItem>}</List>
            <Typography variant={isMobile ? 'subtitle1' : 'h6'}>High Stock Products:</Typography>
            <List dense>{highStock.length ? highStock.map(p => <ListItem key={p.id}><ListItemText primary={p.name} /></ListItem>) : <ListItem><ListItemText primary="N/A" /></ListItem>}</List>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Stock Analysis and Details</Typography>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1">Most Sold Product (Day): {getMostSold(1)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Week): {getMostSold(7)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Month): {getMostSold(30)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Day - Price): {getMostSold(1, true)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Week - Price): {getMostSold(7, true)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Month - Price): {getMostSold(30, true)}</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default StockPage;
