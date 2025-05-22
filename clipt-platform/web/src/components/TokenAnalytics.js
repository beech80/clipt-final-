import React, { useState, useEffect } from 'react';
import axios from 'axios';
// Consider using a charting library like Chart.js or Recharts
// import { Line } from 'react-chartjs-2';
// import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Register Chart.js components if using
// ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'; // Adjust if your API URL is different

/**
 * TokenAnalytics Component
 * Displays analytics related to user token earnings and spending.
 * Fetches data from the backend and visualizes it.
 */
const TokenAnalytics = ({ userId }) => {
    const [analyticsData, setAnalyticsData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('7d'); // Default time range (e.g., '7d', '30d', 'all')

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!userId) {
                setError('User ID is required to fetch analytics.');
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                // TODO: Replace with actual backend endpoint
                // const response = await axios.get(`${API_BASE_URL}/tokens/analytics/${userId}?range=${timeRange}`);
                // Mock data for now
                console.log(`Fetching analytics for userId: ${userId} with range: ${timeRange}`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
                const mockData = {
                    earnings: [
                        { date: '2024-07-18', amount: 50 },
                        { date: '2024-07-19', amount: 75 },
                        { date: '2024-07-20', amount: 120 },
                        { date: '2024-07-21', amount: 90 },
                        { date: '2024-07-22', amount: 110 },
                        { date: '2024-07-23', amount: 60 },
                        { date: '2024-07-24', amount: 150 },
                    ],
                    spending: [
                        { date: '2024-07-19', amount: 20 },
                        { date: '2024-07-21', amount: 50 },
                        { date: '2024-07-24', amount: 100 },
                    ],
                    topEarningActivities: [
                        { activity: 'Watching Streams', total: 300 },
                        { activity: 'Chatting', total: 200 },
                        { activity: 'Daily Login', total: 100 },
                    ],
                    topSpendingItems: [
                        { item: 'Chat Badge', total: 100 },
                        { item: 'Stream Highlight', total: 50 },
                        { item: 'Emote Pack', total: 20 },
                    ],
                };
                setAnalyticsData(mockData);
            } catch (err) {
                console.error('Error fetching token analytics:', err);
                setError('Failed to load token analytics. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, [userId, timeRange]); // Re-fetch when userId or timeRange changes

    const handleTimeRangeChange = (event) => {
        setTimeRange(event.target.value);
    };

    // --- Charting Logic (Example using placeholders) ---
    // TODO: Replace with actual chart implementation using a library like Chart.js or Recharts
    const renderEarningsSpendingChart = () => {
        if (!analyticsData) return <p>No chart data available.</p>;

        // Prepare data for the chart
        // const chartData = {
        //     labels: analyticsData.earnings.map(d => d.date), // Or generate labels based on timeRange
        //     datasets: [
        //         {
        //             label: 'Tokens Earned',
        //             data: analyticsData.earnings.map(d => d.amount),
        //             borderColor: 'rgb(75, 192, 192)',
        //             tension: 0.1
        //         },
        //         {
        //             label: 'Tokens Spent',
        //             data: analyticsData.spending.map(d => d.amount), // Need to align dates or aggregate
        //             borderColor: 'rgb(255, 99, 132)',
        //             tension: 0.1
        //         }
        //     ]
        // };
        // const options = { ... }; // Chart options

        // return <Line options={options} data={chartData} />;
        return (
            <div style={{ border: '1px dashed #ccc', padding: '20px', margin: '10px 0', backgroundColor: '#f9f9f9' }}>
                <h4>Earnings vs. Spending (Placeholder)</h4>
                <p>Chart visualization would go here.</p>
                {/* Example data display */} 
                <h5>Earnings:</h5>
                <ul>{analyticsData.earnings.map(e => <li key={e.date}>{e.date}: {e.amount} tokens</li>)}</ul>
                <h5>Spending:</h5>
                <ul>{analyticsData.spending.map(s => <li key={s.date}>{s.date}: {s.amount} tokens</li>)}</ul>
            </div>
        );
    };

    const renderTopActivities = (title, data) => {
        if (!data || data.length === 0) return <p>No data available for {title}.</p>;
        return (
            <div>
                <h4>{title}</h4>
                <ul>
                    {data.map((item, index) => (
                        <li key={index}>{item.activity || item.item}: {item.total} tokens</li>
                    ))}
                </ul>
            </div>
        );
    };

    // --- Render Logic --- 
    if (!userId) {
        return <p>Please provide a User ID to view analytics.</p>;
    }

    if (isLoading) {
        return <p>Loading token analytics...</p>;
    }

    if (error) {
        return <p style={{ color: 'red' }}>{error}</p>;
    }

    if (!analyticsData) {
        return <p>No analytics data found.</p>;
    }

    return (
        <div className="token-analytics-dashboard" style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
            <h2>Token Analytics</h2>

            <div>
                <label htmlFor="timeRange">Time Range: </label>
                <select id="timeRange" value={timeRange} onChange={handleTimeRangeChange}>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="all">All Time</option>
                </select>
            </div>

            {renderEarningsSpendingChart()}

            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                {renderTopActivities('Top Earning Activities', analyticsData.topEarningActivities)}
                {renderTopActivities('Top Spending Items', analyticsData.topSpendingItems)}
            </div>

            {/* TODO: Add more detailed stats, graphs, or tables as needed */} 
        </div>
    );
};

export default TokenAnalytics;
