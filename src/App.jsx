import React from 'react';
import { Tabs, Tab, Box, Container, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ProductsPage from './pages/ProductsPage';
import TransactionsPage from './pages/TransactionsPage';
import StockPage from './pages/StockPage';
import QueryPage from './pages/QueryPage';
import LedgerPage from './pages/LedgerPage';
import BillingPage from './pages/BillingPage';

function App() {
  const [tab, setTab] = React.useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Container maxWidth="md" disableGutters={isMobile}>
      <Box sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2, boxShadow: 2, mt: isMobile ? 0 : 4 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          centered={!isMobile}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile
        >
          <Tab label="Products" />
          <Tab label="Transactions" />
          <Tab label="Stock" />
          <Tab label="Query DB" />
          <Tab label="Ledger" />
          <Tab label="Billing" />
        </Tabs>
        <Box sx={{ p: isMobile ? 1 : 3 }}>
          {tab === 0 && <ProductsPage />}
          {tab === 1 && <TransactionsPage />}
          {tab === 2 && <StockPage />}
          {tab === 3 && <QueryPage />}
          {tab === 4 && <LedgerPage />}
          {tab === 5 && <BillingPage />}
        </Box>
      </Box>
    </Container>
  );
}

export default App;
