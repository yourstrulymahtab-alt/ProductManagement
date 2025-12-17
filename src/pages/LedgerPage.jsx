import React, { useEffect, useState } from 'react';
import { getTransactions, addTransaction } from '../api/supabaseApi';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Snackbar, Grid } from '@mui/material';

function LedgerPage() {
  const [ledger, setLedger] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

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
        setLedger(Object.values(map));
      } catch (e) {
        setSnackbar({ open: true, message: e.message });
      }
    };
    fetchLedger();
  }, []);

  const handleEdit = (person, contact, txnId, newAmount) => {
    setEditRow({ person, contact, txnId });
    setEditAmount(newAmount);
  };

  const handleSave = async (txn) => {
    try {
      // Only send fields that exist in the DB
      const { isEdit, product, productName, ...txnData } = txn;
      await addTransaction({ ...txnData, amountPaid: parseFloat(editAmount), id: txn.id });
      setSnackbar({ open: true, message: 'Amount paid updated.' });
      setEditRow(null);
      setEditAmount('');
      // Refresh ledger
      const txns = await getTransactions();
      const map = {};
      txns.forEach(t => {
        const key = `${t.personName || t.person_name}|${t.contact}`;
        if (!map[key]) map[key] = { person: t.personName || t.person_name, contact: t.contact, totalToTake: 0, totalToGive: 0, transactions: [] };
        const diff = (t.amountPaid ?? t.amount_paid ?? 0) - (t.totalPrice ?? t.total_price ?? 0);
        if (diff < 0) map[key].totalToTake += Math.abs(diff);
        else if (diff > 0) map[key].totalToGive += diff;
        map[key].transactions.push(t);
      });
      setLedger(Object.values(map));
    } catch (e) {
      setSnackbar({ open: true, message: e.message });
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Typography variant="h5" gutterBottom>Ledger Accounts</Typography>
      {ledger.map((entry, idx) => (
        <Box key={idx} sx={{ mb: 4, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
          <Typography variant="h6">{entry.person} ({entry.contact})</Typography>
          <Typography color={entry.totalToTake > 0 ? 'error' : 'primary'}>
            {entry.totalToTake > 0 ? `Total to Take: ₹${entry.totalToTake.toFixed(2)}` : `Total to Give: ₹${entry.totalToGive.toFixed(2)}`}
          </Typography>
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Total Price</TableCell>
                  <TableCell>Amount Paid</TableCell>
                  <TableCell>Edit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entry.transactions.map(txn => (
                  <TableRow key={txn.id}>
                    <TableCell>{txn.id}</TableCell>
                    <TableCell>{txn.transactionDate || txn.transaction_date}</TableCell>
                    <TableCell>{txn.transactionType || txn.transaction_type}</TableCell>
                    <TableCell>{txn.totalPrice ?? txn.total_price ?? ''}</TableCell>
                    <TableCell>
                      {editRow && editRow.txnId === txn.id ? (
                        <TextField size="small" type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                      ) : (
                        txn.amountPaid ?? txn.amount_paid ?? ''
                      )}
                    </TableCell>
                    <TableCell>
                      {editRow && editRow.txnId === txn.id ? (
                        <Button size="small" onClick={() => handleSave(txn)}>Save</Button>
                      ) : (
                        <Button size="small" onClick={() => handleEdit(entry.person, entry.contact, txn.id, txn.amountPaid ?? txn.amount_paid ?? '')}>Edit</Button>
                      )}
                    </TableCell>
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
