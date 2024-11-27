import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, CircularProgress } from '@mui/material';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [occupancyTrend, setOccupancyTrend] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [spotUtilization, setSpotUtilization] = useState([]);
  const [sensorHealth, setSensorHealth] = useState([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [
          occupancyRes,
          revenueRes,
          utilizationRes,
          sensorRes
        ] = await Promise.all([
          axios.get('http://localhost:3001/api/analytics/occupancy'),
          axios.get('http://localhost:3001/api/analytics/revenue'),
          axios.get('http://localhost:3001/api/analytics/utilization'),
          axios.get('http://localhost:3001/api/analytics/sensors')
        ]);

        setOccupancyTrend(occupancyRes.data);
        setRevenueData(revenueRes.data);
        setSpotUtilization(utilizationRes.data);
        setSensorHealth(sensorRes.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setLoading(false);
      }
    };

    fetchAnalytics();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchAnalytics, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Real-Time Analytics Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Occupancy Rate Trend */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2, height: '400px' }}>
            <Typography variant="h6" gutterBottom>
              Occupancy Rate Trend
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={occupancyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rate" stroke="#8884d8" name="Occupancy Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Revenue Analytics */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2, height: '400px' }}>
            <Typography variant="h6" gutterBottom>
              Revenue Analytics
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#82ca9d" name="Daily Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Spot Utilization */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2, height: '400px' }}>
            <Typography variant="h6" gutterBottom>
              Spot Utilization by Type
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={spotUtilization}
                  dataKey="value"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  label
                >
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Sensor Health */}
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2, height: '400px' }}>
            <Typography variant="h6" gutterBottom>
              Sensor Health Status
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={sensorHealth}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#82ca9d"
                  label
                >
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;
