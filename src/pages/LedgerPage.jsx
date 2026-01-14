import React, { useEffect, useState } from 'react';
import { getTransactions, getLedgerAdjustments, addLedgerAdjustment, getProducts } from '../api/supabaseApi';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Snackbar, Grid, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';

function LedgerPage() {
  const [ledger, setLedger] = useState([]);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [expandedPersons, setExpandedPersons] = useState({});
  const [personAdjustmentHistory, setPersonAdjustmentHistory] = useState({});
  const [products, setProducts] = useState([]);

  const fetchLedger = async () => {
    try {
      const txns = await getTransactions();
      const filteredTxns = txns.filter(t => !t.reversed);
      // Group by person+contact
      const map = {};
      filteredTxns.forEach(t => {
        const key = `${t.personName || t.person_name}|${t.contact}`;
        if (!map[key]) map[key] = { person: t.personName || t.person_name, contact: t.contact, totalToTake: 0, totalToGive: 0, transactions: [] };
        const txnType = t.transactionType || t.transaction_type;
        const diff = txnType === 'return' ? (t.totalPrice ?? t.total_price ?? 0) - (t.amountPaid ?? t.amount_paid ?? 0) : (t.amountPaid ?? t.amount_paid ?? 0) - (t.totalPrice ?? t.total_price ?? 0);
        if (diff < 0) map[key].totalToTake += Math.abs(diff);
        else if (diff > 0) map[key].totalToGive += diff;
        map[key].transactions.push(t);
      });
      // Apply adjustments to totals
      for (const key in map) {
        const [person, contact] = key.split('|');
        try {
          const adjustments = await getLedgerAdjustments(person, contact);
          const adjustmentSum = adjustments.reduce((sum, adj) => sum + adj.adjustment_amount, 0);
          const net = map[key].totalToTake - map[key].totalToGive - adjustmentSum;
          map[key].totalToTake = Math.max(net, 0);
          map[key].totalToGive = Math.max(-net, 0);
        } catch (e) {
          // Ignore if ledger_adjustments table doesn't exist yet
          console.warn('Ledger adjustments not available:', e.message);
        }
      }
      const ledgerEntries = Object.values(map).filter(entry => entry.totalToTake >= 10);
      ledgerEntries.sort((a, b) => Math.max(b.totalToTake, b.totalToGive) - Math.max(a.totalToTake, a.totalToGive));
      setLedger(ledgerEntries);
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  useEffect(() => {
    fetchLedger();
    getProducts().then(setProducts).catch(() => {});
  }, []);

  const handleAdjust = async (person, contact) => {
    try {
      const adjustmentValue = parseFloat(adjustAmount);
      if (isNaN(adjustmentValue)) {
        setSnackbar({ open: true, message: 'Invalid adjustment amount.' });
        return;
      }
      // Record adjustment
      await addLedgerAdjustment({
        person_name: person,
        contact: contact,
        adjustment_amount: adjustmentValue,
        adjustment_date: new Date().toISOString(),
        reason: adjustReason || 'Manual adjustment'
      });
      setSnackbar({ open: true, message: 'Adjustment recorded.' });
      setAdjustAmount('');
      setAdjustReason('');
      // Refresh entire ledger to ensure latest data
      await fetchLedger();
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  const toggleExpansion = async (person, contact) => {
    const key = `${person}|${contact}`;
    const isExpanded = expandedPersons[key];
    setExpandedPersons(prev => ({ ...prev, [key]: !isExpanded }));
    if (!isExpanded) {
      try {
        const history = await getLedgerAdjustments(person, contact);
        setPersonAdjustmentHistory(prev => ({ ...prev, [key]: history }));
      } catch (e) {
        setSnackbar({ open: true, message: 'Failed to load adjustment history: ' + e.message });
      }
    }
  };

  const handleDownloadAdjustments = async (person, contact) => {
    try {
      const adjustments = await getLedgerAdjustments(person, contact);
      const grouped = adjustments.reduce((acc, adj) => {
        const date = new Date(adj.adjustment_date).toLocaleDateString('en-GB');
        if (!acc[date]) acc[date] = [];
        acc[date].push(adj);
        return acc;
      }, {});
      const content = Object.keys(grouped).sort().map(date => {
        const items = grouped[date].map(adj => `${adj.adjustment_amount} "${adj.reason}"`).join('\n');
        return `${date}:\n${items}`;
      }).join('\n\n');
    const htmlContent = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Adjustments</title>
      <style>
        body { font-family: monospace; font-size: 10px; margin: 0; padding: 5px; width: 185px; white-space: pre-wrap; }
        .center { text-align: center; }
        .header { font-weight: bold; }
      </style>
    </head><body>
      <div class='center header'>JHARKHAND STEEL</div>
      <div class='center header'>ADJUSTMENT HISTORY</div>
        <br>
        <div>Name: ${person}</div>
        <div>Contact: ${contact}</div>
        <br>
        ${content}
        <br>
        <div class='center'>Thank you!</div>
      </body></html>`;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adjustments_${person}_${contact}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  const handleDownloadTransactions = async (person, contact) => {
    try {
      const allTxns = await getTransactions();
      const txns = allTxns.filter(t => (t.personName || t.person_name) === person && t.contact === contact && !t.reversed);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const recentTxns = txns.filter(t => new Date(t.transactionDate || t.transaction_date) >= threeMonthsAgo);
      const grouped = recentTxns.reduce((acc, txn) => {
        const date = new Date(txn.transactionDate || txn.transaction_date).toLocaleDateString('en-GB');
        if (!acc[date]) acc[date] = [];
        acc[date].push(txn);
        return acc;
      }, {});
      const content = Object.keys(grouped).sort().map(date => {
        const tableRows = grouped[date].map(txn => {
          const prod = products.find(p => p.id == txn.product_id);
          return `<tr><td style="width: 45%; word-wrap: break-word;">${prod ? prod.name : 'Unknown'}</td><td>${txn.quantity}</td><td>${txn.totalPrice || txn.total_price}</td><td>${txn.transactionType || txn.transaction_type}</td></tr>`;
        }).join('');
        return `<div><strong>${date}:</strong></div><table style="width: 100%; border-collapse: collapse;">${tableRows}</table>`;
      }).join('<br>');
      const htmlContent = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Transactions</title>
        <style>
          body { font-family: monospace; font-size: 10px; margin: 0; padding: 5px; width: 185px; white-space: pre-wrap; }
          .center { text-align: center; }
          .header { font-weight: bold; }
        </style>
      </head><body>
        <div class='center header'>JHARKHAND STEEL</div>
        <div class='center header'>TRANSACTION HISTORY</div>
        <br>
        <div>Name: ${person}</div>
        <div>Contact: ${contact}</div>
        <br>
        ${content}
        <br>
        <div class='center'>Thank you!</div>
      </body></html>`;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${person}_${contact}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Grid container alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Grid item>
          <Typography variant="h5">Ledger Accounts</Typography>
        </Grid>
        <Grid item>
          <Button variant="outlined" onClick={fetchLedger}>Refresh Ledger</Button>
        </Grid>
      </Grid>
      {ledger.map((entry, idx) => (
        <Accordion key={idx} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<Typography>▼</Typography>}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Typography variant="h6" sx={{ color: 'white', fontFamily: 'Garamond, serif', textTransform: 'uppercase' }}>{entry.person} ({entry.contact})</Typography>
              <Typography color={entry.totalToTake > 0 ? 'error' : 'primary'}>
                {entry.totalToTake > 0 ? `Due: ₹${entry.totalToTake.toFixed(2)}` : `Due: ₹${entry.totalToGive.toFixed(2)}`}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2} sx={{ mt: 1, alignItems: 'center' }}>
              <Grid item>
                <TextField size="small" type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="Enter adjustment" />
              </Grid>
              <Grid item>
                <TextField size="small" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Reason" />
              </Grid>
              <Grid item>
                <Button size="small" onClick={() => handleAdjust(entry.person, entry.contact)}>Adjust Total</Button>
              </Grid>
              <Grid item>
                <Button size="small" onClick={() => toggleExpansion(entry.person, entry.contact)}>
                  {expandedPersons[`${entry.person}|${entry.contact}`] ? 'Hide' : 'Show'} History
                </Button>
              </Grid>
              <Grid item>
                <Button size="small" onClick={() => handleDownloadAdjustments(entry.person, entry.contact)}>
                  Download Adjustments
                </Button>
              </Grid>
              <Grid item>
                <Button size="small" onClick={() => handleDownloadTransactions(entry.person, entry.contact)}>
                  Download Transactions
                </Button>
              </Grid>
            </Grid>
            {expandedPersons[`${entry.person}|${entry.contact}`] && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Adjustment History</Typography>
                {personAdjustmentHistory[`${entry.person}|${entry.contact}`] && personAdjustmentHistory[`${entry.person}|${entry.contact}`].length > 0 ? (
                  <TableContainer component={Paper} sx={{ maxHeight: 300, overflowY: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Adjustment Amount</TableCell>
                          <TableCell>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {personAdjustmentHistory[`${entry.person}|${entry.contact}`].map(adj => (
                          <TableRow key={adj.id}>
                            <TableCell>{new Date(adj.adjustment_date).getDate()+"/"+(new Date(adj.adjustment_date).getMonth()+1)+"/"+new Date(adj.adjustment_date).getFullYear()}</TableCell>
                            <TableCell>{adj.adjustment_amount}</TableCell>
                            <TableCell>{adj.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="textSecondary">No adjustments recorded.</Typography>
                )}
              </Box>
            )}
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Product Name</TableCell>
                    <TableCell>Total Price</TableCell>
                    <TableCell>Amount Paid</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entry.transactions.map(txn => (
                    <TableRow key={txn.id}>
                      <TableCell>{txn.id}</TableCell>
                      <TableCell>{new Date(txn.transactionDate || txn.transaction_date).toISOString().split('T')[0]}</TableCell>
                      <TableCell>{txn.transactionType || txn.transaction_type}</TableCell>
                      <TableCell>{txn.productName}</TableCell>
                      <TableCell>{txn.totalPrice ?? txn.total_price ?? ''}</TableCell>
                      <TableCell>{txn.amountPaid ?? txn.amount_paid ?? ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}
      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
  );
}

export default LedgerPage;
