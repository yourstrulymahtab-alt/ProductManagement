// ...existing code...

import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Snackbar, Grid, useMediaQuery } from '@mui/material';
import { saveAs } from 'file-saver';
import { useTheme } from '@mui/material/styles';

import { supabase } from '../api/supabaseClient';
function QueryPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState([]);
  const [columns, setColumns] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleRun = async () => {
    // Only allow SELECT queries for safety
    if (!/^\s*select/i.test(query)) {
      setSnackbar({ open: true, message: 'Only SELECT queries are allowed.' });
      return;
    }
    try {
      // Try to detect table name for simple SELECT * FROM table queries
      const match = query.match(/from\s+([a-zA-Z0-9_]+)/i);
      if (!match) throw new Error('Could not detect table name.');
      const table = match[1];
      // Only allow products or transactions for now
      if (!['products', 'transactions'].includes(table)) throw new Error('Only products or transactions table allowed.');
      // Use Supabase's select for simple queries
      let { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      if (!data || data.length === 0) {
        setColumns([]);
        setResult([]);
        setSnackbar({ open: true, message: 'No results.' });
        return;
      }
      setColumns(Object.keys(data[0]));
      setResult(data);
    } catch (e) {
      setColumns([]);
      setResult([]);
      setSnackbar({ open: true, message: e.message });
    }
  };

  // CSV Download
  const handleDownloadCSV = () => {
    if (!columns.length || !result.length) return;
    let csv = columns.join(',') + '\n';
    result.forEach(row => {
      csv += columns.map(col => JSON.stringify(row[col] ?? '')).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'query_result.csv');
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: isMobile ? 1 : 3 }}>
      <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>Custom SQL Query</Typography>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={12} sm={9}>
          <TextField label="Enter SQL Query" fullWidth multiline minRows={2} value={query} onChange={e => setQuery(e.target.value)} />
        </Grid>
        <Grid item xs={6} sm={1.5} textAlign={isMobile ? 'left' : 'right'}>
          <Button variant="contained" onClick={handleRun} sx={{ mt: isMobile ? 1 : 0 }} fullWidth={isMobile}>Run Query</Button>
        </Grid>
        <Grid item xs={6} sm={1.5} textAlign={isMobile ? 'left' : 'right'}>
          <Button variant="outlined" onClick={handleDownloadCSV} disabled={!columns.length || !result.length} sx={{ mt: isMobile ? 1 : 0 }} fullWidth={isMobile}>Download CSV</Button>
        </Grid>
      </Grid>
      {columns.length > 0 && (
        <TableContainer component={Paper}>
          <Table size={isMobile ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                {columns.map(col => <TableCell key={col}>{col}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {result.map((row, i) => (
                <TableRow key={i}>
                  {columns.map(col => <TableCell key={col}>{row[col]}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
  );
}

export default QueryPage;
