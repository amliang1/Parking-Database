import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Tooltip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  ReportProblem as ViolationIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const { logout } = useAuth();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
          VisionGuard
        </Typography>

        <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
          <Button
            component={Link}
            to="/"
            color="inherit"
            startIcon={<DashboardIcon />}
            sx={{ color: isActive('/') ? 'secondary.main' : 'inherit' }}
          >
            Dashboard
          </Button>

          <Button
            component={Link}
            to="/analytics"
            color="inherit"
            startIcon={<AnalyticsIcon />}
            sx={{ color: isActive('/analytics') ? 'secondary.main' : 'inherit' }}
          >
            Analytics
          </Button>

          <Button
            component={Link}
            to="/violations/new"
            color="inherit"
            startIcon={<ViolationIcon />}
            sx={{ color: isActive('/violations/new') ? 'secondary.main' : 'inherit' }}
          >
            Record Violation
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Notifications">
            <IconButton color="inherit" component={Link} to="/notifications">
              <NotificationsIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Profile">
            <IconButton color="inherit" component={Link} to="/profile">
              <PersonIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;