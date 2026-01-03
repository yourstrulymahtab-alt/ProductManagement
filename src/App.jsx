import React from 'react';
import { Tabs, Tab, Box, Container, useMediaQuery, AppBar, Toolbar, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ProductsPage from './pages/ProductsPage';
import TransactionsPage from './pages/TransactionsPage';
import InsightsPage from './pages/InsightsPage';
import QueryPage from './pages/QueryPage';
import LedgerPage from './pages/LedgerPage';
import BillingPage from './pages/BillingPage';

function App() {
  const [tab, setTab] = React.useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
        <Toolbar sx={{ px: isMobile ? 2 : 3 }}>
          <img src="/JharkhandSteel.svg" alt="Jharkhand Steel Logo" style={{ height: '40px', marginRight: '16px' }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            JHARKHAND STEEL
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ width: '100%', bgcolor: 'background.paper', minHeight: 'calc(100vh - 64px)', p: isMobile ? 1 : 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          centered={!isMobile}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile
          sx={{ mb: 2 }}
        >
          <Tab label="Billing" />
          <Tab label="Ledger" />
          <Tab label="Transactions" />
          <Tab label="Products" />
          <Tab label="Insights" />
          <Tab label="Query DB" />
        </Tabs>
        <Box sx={{ p: isMobile ? 1 : 3 }}>
          {tab === 0 && <BillingPage />}
          {tab === 1 && <LedgerPage />}
          {tab === 2 && <TransactionsPage />}
          {tab === 3 && <ProductsPage />}
          {tab === 4 && <InsightsPage />}
          {tab === 5 && <QueryPage />}
        </Box>
      </Box>
    </Box>
  );
}

export default App;
