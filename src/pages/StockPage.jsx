// ...existing code...

import React, { useEffect, useState } from 'react';
import { getProducts, getTransactions } from '../api/supabaseApi';
import { Box, Typography, Paper, List, ListItem, ListItemText, Button, Grid, useMediaQuery, TextField } from '@mui/material';
import { useTheme } from '@mui/material/styles';

function StockPage() {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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

  // Low Stock
  const lowStock = products.filter(p => p.stock < 10);

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
      const qty = Number(t.quantity);
      let txnPrice = t.transactionPrice ?? t.transaction_price ?? t.price;
      txnPrice = Number(txnPrice);
      // Only add if both are valid numbers
      if (!isNaN(qty)) stats[name].qty += qty;
      if (!isNaN(qty) && !isNaN(txnPrice)) stats[name].price += qty * txnPrice;
    });
    let max = null;
    for (const [name, s] of Object.entries(stats)) {
      if (!max || (byPrice ? s.price > max.val : s.qty > max.val)) {
        max = { name, val: byPrice ? s.price : s.qty };
      }
    }
    return max ? `${max.name} (${byPrice ? '₹' + max.val.toFixed(2) : max.val + ' units'})` : 'N/A';
  };

  // Total cost price of products in warehouse
  const totalCostPrice = products.reduce((sum, p) => sum + (Number(p.costPrice) * Number(p.stock)), 0);

  // Top 10 frequently sold products
  const top10FrequentSold = () => {
    const stats = {};
    transactions.filter(t => t.transaction_type === 'sell' || t.transactionType === 'sell').forEach(t => {
      const name = t.productName || t.product_name || t.product_id;
      if (!stats[name]) stats[name] = 0;
      stats[name] += Number(t.quantity) || 0;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, qty]) => `${name} (${qty} units)`);
  };

  // Top 5 products not sold for a long time
  const top5NotSoldLong = () => {
    const lastSale = {};
    transactions.filter(t => t.transaction_type === 'sell' || t.transactionType === 'sell').forEach(t => {
      const name = t.productName || t.product_name || t.product_id;
      const date = new Date(t.transaction_date || t.transactionDate);
      if (!lastSale[name] || date > lastSale[name]) lastSale[name] = date;
    });
    return Object.entries(lastSale).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([name, date]) => `${name} (Last sold: ${date.toLocaleDateString()})`);
  };

  // Filtered sales and profit for date range
  const filteredSalesProfit = () => {
    if (!startDate || !endDate) return { sales: 0, profit: 0 };
    const start = new Date(startDate);
    const end = new Date(endDate);
    const filtered = transactions.filter(t => (t.transaction_type === 'sell' || t.transactionType === 'sell') && new Date(t.transaction_date || t.transactionDate) >= start && new Date(t.transaction_date || t.transactionDate) <= end);
    let sales = 0;
    let profit = 0;
    filtered.forEach(t => {
      const qty = Number(t.quantity);
      const txnPrice = Number(t.transactionPrice ?? t.transaction_price ?? t.price);
      const product = products.find(p => p.id === t.product_id || p.id === t.productId);
      const costPrice = product ? Number(product.costPrice) : 0;
      if (!isNaN(qty) && !isNaN(txnPrice)) {
        sales += qty * txnPrice;
        profit += qty * (txnPrice - costPrice);
      }
    });
    return { sales, profit };
  };

  const { sales, profit } = filteredSalesProfit();

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: isMobile ? 1 : 3 }}>
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} sm={6}>
          <Button variant="outlined" onClick={fetchData} sx={{ mb: 2 }} fullWidth={isMobile}>Refresh Stock Analysis</Button>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant={isMobile ? 'subtitle1' : 'h6'}>Low Stock Products:</Typography>
            <List dense>{lowStock.length ? lowStock.map(p => <ListItem key={p.id}><ListItemText primary={p.name} /></ListItem>) : <ListItem><ListItemText primary="N/A" /></ListItem>}</List>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Stock Analysis and Details</Typography>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1">Most Sold Product (Day): {getMostSold(1)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Week): {getMostSold(7)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Month): {getMostSold(30)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Day - Price): {getMostSold(1, true)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Week - Price): {getMostSold(7, true)}</Typography>
            <Typography variant="subtitle1">Most Sold Product (Month - Price): {getMostSold(30, true)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Date Filters for Sales and Profit</Typography>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
            </Grid>
            <Typography variant="subtitle1">Total Sales: ₹{sales.toFixed(2)}</Typography>
            <Typography variant="subtitle1">Total Profit: ₹{profit.toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Top 10 Frequently Sold Products</Typography>
          <Paper sx={{ p: 2 }}>
            <List dense>
              {top10FrequentSold().length ? top10FrequentSold().map((item, index) => <ListItem key={index}><ListItemText primary={item} /></ListItem>) : <ListItem><ListItemText primary="N/A" /></ListItem>}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Top 5 Products Not Sold for Long Time</Typography>
          <Paper sx={{ p: 2 }}>
            <List dense>
              {top5NotSoldLong().length ? top5NotSoldLong().map((item, index) => <ListItem key={index}><ListItemText primary={item} /></ListItem>) : <ListItem><ListItemText primary="N/A" /></ListItem>}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Total Cost Price of Products in Warehouse</Typography>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1">Total Cost Price: ₹{totalCostPrice.toFixed(2)}</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default StockPage;
