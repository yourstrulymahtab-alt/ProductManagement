import React, { useEffect, useState } from 'react';
import { getTransactions, getLedgerAdjustments, addLedgerAdjustment, getProducts } from '../api/supabaseApi';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button, Snackbar, Grid, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';

function LedgerPage() {
  const [ledger, setLedger] = useState([]);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustEffectiveDate, setAdjustEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [expandedPersons, setExpandedPersons] = useState({});
  const [personAdjustmentHistory, setPersonAdjustmentHistory] = useState({});
  const [products, setProducts] = useState([]);

  const fetchLedger = async () => {
    try {
      const txns = await getTransactions();
      const filteredTxns = txns.filter(t => !t.reversed);
      // Group transactions by person+contact+transactionDay
      const dayKey = (d) => {
        const dt = new Date(d);
        // Use local date formatting consistent with previous UI (YYYY-MM-DD)
        // If transactionDate is already YYYY-MM-DD, keep it as-is
        const asStr = d && typeof d === 'string' ? d : null;
        if (asStr && /^\d{4}-\d{2}-\d{2}$/.test(asStr)) return asStr;
        return dt.toISOString().split('T')[0];

      };

      const map = {};
      // map[person|contact] => { person, contact, days: { [date]: { txns: [], txnNet: number, adjNet: number } }, orderedDates: [] }
      filteredTxns.forEach(t => {
        const person = t.personName || t.person_name;
        const contact = t.contact;
        const key = `${person}|${contact}`;
        const txnDay = dayKey(t.transactionDate || t.transaction_date);

        if (!map[key]) {
          map[key] = { person, contact, days: {}, finalDue: 0, orderedDates: [] };
        }
        if (!map[key].days[txnDay]) {
          map[key].days[txnDay] = { txns: [], txnNet: 0, adjNet: 0 };
        }
        const txnType = t.transactionType || t.transaction_type;
        const totalPrice = t.totalPrice ?? t.total_price ?? 0;
        const amountPaid = t.amountPaid ?? t.amount_paid ?? 0;

        // Keep the existing ledger meaning but convert to a signed daily net.
        // In old code:
        // - return: diff = totalPrice - amountPaid
        // - sell:   diff = amountPaid - totalPrice
        // diff<0 => totalToTake += abs(diff)
        // diff>0 => totalToGive += diff
        // So signedNet = totalToGive - totalToTake = diff (as-is)
        const signedDiff = txnType === 'return' ? (totalPrice - amountPaid) : (amountPaid - totalPrice);
        map[key].days[txnDay].txnNet += signedDiff;
        map[key].days[txnDay].txns.push(t);
      });

      // Apply adjustments day-wise and compute running due
      for (const key of Object.keys(map)) {
        const { person, contact, days } = map[key];
        let adjustments = [];
        try {
          adjustments = await getLedgerAdjustments(person, contact);
        } catch (e) {
          console.warn('Ledger adjustments not available:', e.message);
        }

        const adjByDay = {};
        adjustments.forEach(adj => {
          const effDay = dayKey(adj.effective_date ?? adj.adjustment_date);
          if (!adjByDay[effDay]) adjByDay[effDay] = 0;
          // In old code, adjustment_amount was subtracted from (take-give)
          // With signedNet = (give - take), the old due formula corresponds to: netAfterAdj = (take - give) - adjSum
          // Equivalent signed representation: signedNetAfterAdj = signedNet - ( -adj )? To keep consistent with old behavior,
          // treat adjustment_amount as reducing (take-give). Since signedNet = (give - take) = -(take-give),
          // signedNetAfterAdj = signedNet + adjustment_amount.
          adjByDay[effDay] += Number(adj.adjustment_amount || 0);
        });

        const orderedDates = Array.from(new Set(Object.keys(days).concat(Object.keys(adjByDay)))).sort();
        map[key].orderedDates = orderedDates;

        let signedRunningNet = 0; // signedNet = give - take
        let take = 0;
        let give = 0;

        orderedDates.forEach(d => {
          if (!days[d]) days[d] = { txns: [], txnNet: 0, adjNet: 0 };
          const txnSigned = Number(days[d].txnNet || 0);
          const adjSigned = Number(adjByDay[d] || 0);
          days[d].adjNet = adjSigned;

          signedRunningNet += txnSigned;
          // apply adjustments on this day
          signedRunningNet += adjSigned;

          // convert signedRunningNet back to due display
          // signedRunningNet = give - take
          // => take = max(-signed,0), give = max(signed,0)
          take = Math.max(-signedRunningNet, 0);
          give = Math.max(signedRunningNet, 0);
          days[d].dueTake = take;
          days[d].dueGive = give;
        });

        // final due stored on entry
        map[key].finalDue = take;
      }

      // Build ledger entries for UI (show those with due >= 10 or have negative balance)
      const ledgerEntries = Object.values(map)
        .filter(entry => (entry.finalDue >= 10))
        .map(entry => ({
          person: entry.person,
          contact: entry.contact,
          days: entry.days,
          orderedDates: entry.orderedDates,
          totalToTake: entry.orderedDates.length ? entry.days[entry.orderedDates[entry.orderedDates.length - 1]].dueTake : 0,
          totalToGive: entry.orderedDates.length ? entry.days[entry.orderedDates[entry.orderedDates.length - 1]].dueGive : 0,
        }));

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
      // Record adjustment (effective on selected date for day-wise ledger)
      await addLedgerAdjustment({
        person_name: person,
        contact: contact,
        adjustment_amount: adjustmentValue,
        adjustment_date: new Date().toISOString(),
        effective_date: adjustEffectiveDate,
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
        body { font-family: monospace; font-size: 10px; margin: 0; padding: 5px; width: 180px; white-space: pre-wrap; }
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
        const txns = grouped[date];
        const sumTotalPrice = txns.reduce((sum, txn) => {
          const price = txn.totalPrice || txn.total_price || 0;
          const type = txn.transactionType || txn.transaction_type;
          if (type === 'return') return sum - price;
          return sum + price;
        }, 0);
        const tableRows = txns.map(txn => {
          const prod = products.find(p => p.id == txn.product_id);
          return `<tr><td style="width: 45%; word-wrap: break-word;">${prod ? prod.name : 'Unknown'}</td><td>${txn.quantity}</td><td>${txn.totalPrice || txn.total_price}</td><td>${txn.transactionType || txn.transaction_type}</td></tr>`;
        }).join('');
        return `<div><strong>${date} (Total: ₹${sumTotalPrice.toFixed(2)}):</strong></div><table style="width: 100%; border-collapse: collapse;">${tableRows}</table>`;
      }).join('<br>');
      const htmlContent = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Transactions</title>
        <style>
          body { font-family: monospace; font-size: 10px; margin: 0; padding: 5px; width: 180px; white-space: pre-wrap; }
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
                <TextField
                  size="small"
                  type="number"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="Enter adjustment"
                />
              </Grid>
              <Grid item>
                <TextField size="small" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Reason" />
              </Grid>
              <Grid item>
                <TextField
                  size="small"
                  type="date"
                  value={adjustEffectiveDate}
                  onChange={(e) => setAdjustEffectiveDate(e.target.value)}
                />
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
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Day-wise Ledger</Typography>
              {entry.orderedDates && entry.orderedDates.length > 0 ? (
                entry.orderedDates.map(date => (
                  <Box key={date} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Date: {date}</Typography>
                      <Typography variant="body2" color={entry.days[date]?.dueTake > 0 ? 'error' : 'primary'}>
                        Due: {entry.days[date]?.dueTake > 0 ? `₹${(entry.days[date]?.dueTake || 0).toFixed(2)}` : `₹${(entry.days[date]?.dueGive || 0).toFixed(2)}`}
                      </Typography>
                    </Box>
                    <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                      Transactions Net: {entry.days[date]?.txnNet || 0} &nbsp;•&nbsp; Adjustments Effective: {entry.days[date]?.adjNet || 0}
                    </Typography>
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Product Name</TableCell>
                            <TableCell>Total Price</TableCell>
                            <TableCell>Amount Paid</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(entry.days[date]?.txns || []).map(txn => (
                            <TableRow key={txn.id}>
                              <TableCell>{txn.id}</TableCell>
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
                ))
              ) : (
                <Typography variant="body2" color="textSecondary">No transactions available.</Typography>
              )}
            </Box>

          </AccordionDetails>
        </Accordion>
      ))}
      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
  );
}

export default LedgerPage;
