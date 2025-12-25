import React, { useEffect, useState } from 'react';
import { getTransactions, addTransaction, getLedgerAdjustments, addLedgerAdjustment } from '../api/supabaseApi';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Snackbar, Grid } from '@mui/material';

function LedgerPage() {
  const [ledger, setLedger] = useState([]);
  const [adjustRow, setAdjustRow] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [expandedPersons, setExpandedPersons] = useState({});
  const [personAdjustmentHistory, setPersonAdjustmentHistory] = useState({});

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        const txns = await getTransactions();
        // Group by person+contact
        const map = {};
        txns.forEach(t => {
          const key = `${t.personName || t.person_name}|${t.contact}`;
          if (!map[key]) map[key] = { person: t.personName || t.person_name, contact: t.contact, totalToTake: 0, totalToGive: 0, transactions: [] };
          const diff = (t.amountPaid ?? t.amount_paid ?? 0) - (t.totalPrice ?? t.total_price ?? 0);
          if (diff < 0) map[key].totalToTake += Math.abs(diff);
          else if (diff > 0) map[key].totalToGive += diff;
          map[key].transactions.push(t);
        });
        // Apply adjustments to totals (optional, if table exists)
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
        const ledgerEntries = Object.values(map).filter(entry => entry.totalToTake >= 10 || entry.totalToGive >= 10);
        ledgerEntries.sort((a, b) => Math.max(b.totalToTake, b.totalToGive) - Math.max(a.totalToTake, a.totalToGive));
        setLedger(ledgerEntries);
      } catch (e) {
        setSnackbar({ open: true, message: e.message });
      }
    };
    fetchLedger();
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
      // Refresh ledger
      const updatedTxns = await getTransactions();
      const adjustments = await getLedgerAdjustments(person, contact);
      const adjustmentSum = adjustments.reduce((sum, adj) => sum + adj.adjustment_amount, 0);
      const map = {};
      updatedTxns.forEach(t => {
        const key = `${t.personName || t.person_name}|${t.contact}`;
        if (!map[key]) map[key] = { person: t.personName || t.person_name, contact: t.contact, totalToTake: 0, totalToGive: 0, transactions: [] };
        const diff = (t.amountPaid ?? t.amount_paid ?? 0) - (t.totalPrice ?? t.total_price ?? 0);
        if (diff < 0) map[key].totalToTake += Math.abs(diff);
        else if (diff > 0) map[key].totalToGive += diff;
        map[key].transactions.push(t);
      });
      // Apply adjustments to totals
      const key = `${person}|${contact}`;
      if (map[key]) {
        const net = map[key].totalToTake - map[key].totalToGive - adjustmentSum;
        map[key].totalToTake = Math.max(net, 0);
        map[key].totalToGive = Math.max(-net, 0);
      }
      const ledgerEntries = Object.values(map).filter(entry => entry.totalToTake >= 10 || entry.totalToGive >= 10);
      ledgerEntries.sort((a, b) => Math.max(b.totalToTake, b.totalToGive) - Math.max(a.totalToTake, a.totalToGive));
      setLedger(ledgerEntries);
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

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Typography variant="h5" gutterBottom>Ledger Accounts</Typography>
      {ledger.map((entry, idx) => (
        <Box key={idx} sx={{ mb: 4, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ color: 'blue' }}>{entry.person} ({entry.contact})</Typography>
          <Typography color={entry.totalToTake > 0 ? 'error' : 'primary'}>
            {entry.totalToTake > 0 ? `Total to Take: ₹${entry.totalToTake.toFixed(2)}` : `Total to Give: ₹${entry.totalToGive.toFixed(2)}`}
          </Typography>
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
          </Grid>
          {expandedPersons[`${entry.person}|${entry.contact}`] && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Adjustment History</Typography>
              {personAdjustmentHistory[`${entry.person}|${entry.contact}`] && personAdjustmentHistory[`${entry.person}|${entry.contact}`].length > 0 ? (
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
                        <TableCell>{new Date(adj.adjustment_date).toLocaleString()}</TableCell>
                        <TableCell>{adj.adjustment_amount}</TableCell>
                        <TableCell>{adj.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
        </Box>
      ))}
      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
  );
}

export default LedgerPage;
