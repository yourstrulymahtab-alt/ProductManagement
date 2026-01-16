// ...existing code...

import React, { useEffect, useState } from 'react';
import { getProducts, getTransactions } from '../api/supabaseApi';
import { Box, Typography, Paper, List, ListItem, ListItemText, Button, Grid, useMediaQuery, TextField, Card, CardContent } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

function InsightsPage() {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [startDate, setStartDate] = useState(today.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(tomorrow.toISOString().split('T')[0]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const fetchData = async () => {
    try {
      setProducts(await getProducts());
      // Fetch all transactions for comprehensive analysis including date filters
      const txns = await getTransactions();
      setTransactions(txns);
    } catch {
      // Optionally show error
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Low Stock (stock < 30)
  const getSoldQuantities = () => {
    const stats = {};
    transactions.filter(t => t.transaction_type === 'sell' || t.transactionType === 'sell').forEach(t => {
      const productId = t.product_id || t.productId;
      if (!stats[productId]) stats[productId] = 0;
      stats[productId] += Number(t.quantity) || 0;
    });
    return stats;
  };

  const soldQuantities = getSoldQuantities();

  const lowStock = products
    .filter(p => p.stock < 30)
    .sort((a, b) => {
      const aSold = soldQuantities[a.id] || 0;
      const bSold = soldQuantities[b.id] || 0;
      if (aSold > 0 || bSold > 0) {
        return bSold - aSold; // Most sold first
      } else {
        return a.costPrice - b.costPrice; // Least cost price first
      }
    });

  // Out of Stock
  const outOfStock = products.filter(p => p.stock === 0);

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
    const filtered = transactions.filter(t => ((t.transaction_type === 'sell' || t.transactionType === 'sell') || (t.transaction_type === 'return' || t.transactionType === 'return')) && new Date(t.transaction_date || t.transactionDate) >= start && new Date(t.transaction_date || t.transactionDate) <= end);
    let sales = 0;
    let profit = 0;
    filtered.forEach(t => {
      const qty = Number(t.quantity);
      const txnPrice = Number(t.transactionPrice ?? t.transaction_price ?? t.price);
      const product = products.find(p => p.id === t.product_id || p.id === t.productId);
      const costPrice = product ? Number(product.costPrice) : 0;
      if (!isNaN(qty) && !isNaN(txnPrice)) {
        const amount = qty * txnPrice;
        const profitAmount = qty * (txnPrice - costPrice);
        if (t.transaction_type === 'return' || t.transactionType === 'return') {
          sales -= amount;
          profit -= profitAmount;
        } else {
          sales += amount;
          profit += profitAmount;
        }
      }
    });
    return { sales, profit };
  };

  // Daily sales and profit data for chart
  const getDailySalesProfitData = () => {
    const dailyData = {};
    transactions.filter(t => (t.transaction_type === 'sell' || t.transactionType === 'sell') || (t.transaction_type === 'return' || t.transactionType === 'return')).forEach(t => {
      const date = new Date(t.transaction_date || t.transactionDate).toISOString().split('T')[0];
      if (!dailyData[date]) dailyData[date] = { sales: 0, profit: 0 };
      const qty = Number(t.quantity);
      const txnPrice = Number(t.transactionPrice ?? t.transaction_price ?? t.price);
      const product = products.find(p => p.id === t.product_id || p.id === t.productId);
      const costPrice = product ? Number(product.costPrice) : 0;
      if (!isNaN(qty) && !isNaN(txnPrice)) {
        const amount = qty * txnPrice;
        const profitAmount = qty * (txnPrice - costPrice);
        if (t.transaction_type === 'return' || t.transactionType === 'return') {
          dailyData[date].sales -= amount;
          dailyData[date].profit -= profitAmount;
        } else {
          dailyData[date].sales += amount;
          dailyData[date].profit += profitAmount;
        }
      }
    });
    const sortedDates = Object.keys(dailyData).sort();
    return {
      labels: sortedDates,
      datasets: [
        {
          label: 'Sales',
          data: sortedDates.map(date => dailyData[date].sales),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
        {
          label: 'Profit',
          data: sortedDates.map(date => dailyData[date].profit),
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
        },
      ],
    };
  };

  // Daily cost price changes
  const getDailyCostPriceData = () => {
    const dailyData = {};
    transactions.forEach(t => {
      const date = new Date(t.transaction_date || t.transactionDate).toISOString().split('T')[0];
      if (!dailyData[date]) dailyData[date] = 0;
      const qty = Number(t.quantity);
      const product = products.find(p => p.id === t.product_id || p.id === t.productId);
      const costPrice = product ? Number(product.costPrice) : 0;
      if (t.transaction_type === 'return' || t.transactionType === 'return') {
        dailyData[date] += qty * costPrice;
      } else if (t.transaction_type === 'sell' || t.transactionType === 'sell') {
        dailyData[date] -= qty * costPrice;
      }
    });
    const sortedDates = Object.keys(dailyData).sort();
    return {
      labels: sortedDates,
      datasets: [
        {
          label: 'Cost Price Change',
          data: sortedDates.map(date => dailyData[date]),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
        },
      ],
    };
  };

  const { sales, profit } = filteredSalesProfit();
  const salesProfitChartData = getDailySalesProfitData();
  const costPriceChartData = getDailyCostPriceData();

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: isMobile ? 1 : 3 }}>
      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12}>
          <Button variant="outlined" onClick={fetchData} sx={{ mb: 2 }} fullWidth={isMobile}>Refresh Stock Analysis</Button>
        </Grid>

        {/* Charts Section */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Sales and Profit Over Time</Typography>
                  <Box sx={{ height: 300 }}>
                    <Bar data={salesProfitChartData} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: {
                          title: {
                            display: true,
                            text: 'Date'
                          }
                        },
                        y: {
                          title: {
                            display: true,
                            text: 'Amount (₹)'
                          }
                        }
                      }
                    }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Warehouse Cost Price Changes</Typography>
                  <Box sx={{ height: 300 }}>
                    <Line data={costPriceChartData} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: {
                          title: {
                            display: true,
                            text: 'Date'
                          }
                        },
                        y: {
                          title: {
                            display: true,
                            text: 'Cost Price Change (₹)'
                          }
                        }
                      }
                    }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Stock Status Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" color="warning.main" gutterBottom>Low Stock Products</Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {lowStock.length ? lowStock.map(p => <ListItem key={p.id}><ListItemText primary={`${p.name} (${p.stock})`} /></ListItem>) : <ListItem><ListItemText primary="N/A" /></ListItem>}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" color="error.main" gutterBottom>Out of Stock Products</Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {outOfStock.length ? outOfStock.map(p => <ListItem key={p.id}><ListItemText primary={p.name} /></ListItem>) : <ListItem><ListItemText primary="N/A" /></ListItem>}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Analysis Details Card */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Stock Analysis and Details</Typography>
              <Typography variant="body2">Most Sold Product (Day): {getMostSold(1)}</Typography>
              <Typography variant="body2">Most Sold Product (Week): {getMostSold(7)}</Typography>
              <Typography variant="body2">Most Sold Product (Month): {getMostSold(30)}</Typography>
              <Typography variant="body2">Most Sold Product (Day - Price): {getMostSold(1, true)}</Typography>
              <Typography variant="body2">Most Sold Product (Week - Price): {getMostSold(7, true)}</Typography>
              <Typography variant="body2">Most Sold Product (Month - Price): {getMostSold(30, true)}</Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Date Filters and Sales/Profit Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Date Filters for Sales and Profit</Typography>
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
              <Box sx={{ mt: 2 }}>
                <Typography variant="body1">Total Sales: ₹{sales.toFixed(2)}</Typography>
                <Typography variant="body1">Total Profit: ₹{profit.toFixed(2)}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Products Cards */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Top 10 Frequently Sold Products</Typography>
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {top10FrequentSold().length ? top10FrequentSold().map((item, index) => <ListItem key={index}><ListItemText primary={item} /></ListItem>) : <ListItem><ListItemText primary="N/A" /></ListItem>}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Top 5 Products Not Sold for Long Time</Typography>
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {top5NotSoldLong().length ? top5NotSoldLong().map((item, index) => <ListItem key={index}><ListItemText primary={item} /></ListItem>) : <ListItem><ListItemText primary="N/A" /></ListItem>}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Cost Price Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Total Cost Price of Products in Warehouse</Typography>
              <Typography variant="h5" color="primary">₹{totalCostPrice.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default InsightsPage;
