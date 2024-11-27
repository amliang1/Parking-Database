import React, { useState } from 'react';
import {
  Box,
  Snackbar,
  Alert,
} from '@mui/material';
import LiveVehicleFeed from './LiveVehicleFeed';
import OccupancyIndicator from './OccupancyIndicator';
import AlertsPanel from './AlertsPanel';
import QuickActions from './QuickActions';
import StatisticsWidgets from './StatisticsWidgets';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2, p: 2 }}>
      <Box sx={{ gridColumn: 'span 8' }}>
        <StatisticsWidgets />
      </Box>
      <Box sx={{ gridColumn: 'span 4' }}>
        <AlertsPanel />
      </Box>
      <Box sx={{ gridColumn: 'span 12' }}>
        <QuickActions />
      </Box>
      <Box sx={{ gridColumn: 'span 8' }}>
        <LiveVehicleFeed />
      </Box>
      <Box sx={{ gridColumn: 'span 4' }}>
        <OccupancyIndicator />
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;
