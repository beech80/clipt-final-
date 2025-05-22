import React, { useState, useEffect } from 'react';
import axios from 'axios';

// TODO: Replace with your actual API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// --- Mock Data (Replace with API call) --- 
const MOCK_TIERS = [
    {
        id: 'free',
        name: 'Free Tier',
        price: 0,
        currency: 'USD',
        features: [
            'Basic stream access',
            'Limited chat features',
            'Earn tokens at standard rate'
        ],
        tokenMultiplier: 1,
    },
    {
        id: 'basic',
        name: 'Basic Supporter',
        price: 5,
        currency: 'USD',
        features: [
            'Ad-free viewing',
            'Enhanced chat features (badges)',
            '1.5x token earning rate',
            'Access to basic boosts'
        ],
        tokenMultiplier: 1.5,
    },
    {
        id: 'premium',
        name: 'Premium Supporter',
        price: 15,
        currency: 'USD',
        features: [
            'All Basic features',
            'Exclusive chat emotes',
            '2x token earning rate',
            'Access to premium boosts',
            'Priority support'
        ],
        tokenMultiplier: 2,
    },
];

/**
 * SubscriptionManager Component
 * Allows users to view available subscription tiers and upgrade their plan.
 */
const SubscriptionManager = ({ userId }) => {
    const [availableTiers, setAvailableTiers] = useState([]);
    const [currentUserTier, setCurrentUserTier] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);

    useEffect(() => {
        const fetchSubscriptionData = async () => {
            if (!userId) {
                setError('User ID is required.');
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                // TODO: Replace with actual API calls
                // Fetch available tiers (could be static or from API)
                setAvailableTiers(MOCK_TIERS);

                // Fetch user's current subscription tier
                // const response = await axios.get(`${API_BASE_URL}/subscriptions/user/${userId}`);
                // setCurrentUserTier(response.data.tierId || 'free'); // Assuming API returns tierId
                await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
                setCurrentUserTier('free'); // Mock current tier

            } catch (err) {
                console.error('Error fetching subscription data:', err);
                setError('Failed to load subscription information.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSubscriptionData();
    }, [userId]);

    const handleUpgradeClick = async (tierId) => {
        if (isProcessingUpgrade || !userId) return;

        setIsProcessingUpgrade(true);
        setError(null);
        console.log(`Attempting to upgrade user ${userId} to tier ${tierId}`);

        try {
            // --- Payment Integration Placeholder --- 
            // 1. Call your backend to create a checkout session (e.g., with Stripe)
            // const response = await axios.post(`${API_BASE_URL}/subscriptions/create-checkout-session`, {
            //     userId: userId,
            //     tierId: tierId,
            //     successUrl: window.location.href, // URL to redirect after success
            //     cancelUrl: window.location.href, // URL to redirect after cancellation
            // });
            
            // 2. Redirect to Stripe Checkout or use Stripe Elements
            // const { sessionId } = response.data;
            // const stripe = await loadStripe('YOUR_STRIPE_PUBLISHABLE_KEY'); 
            // await stripe.redirectToCheckout({ sessionId });

            // --- Mock Success --- 
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing
            console.log(`Mock upgrade successful for tier ${tierId}`);
            // Update the UI to reflect the new tier (ideally re-fetch user data)
            setCurrentUserTier(tierId);
            alert(`Successfully upgraded to ${tierId} tier! (Mock)`);
            // In a real app, you'd likely rely on the successUrl redirect and backend webhooks
            // to confirm the subscription update.

        } catch (err) {
            console.error('Error initiating upgrade process:', err);
            setError(`Failed to start the upgrade process for ${tierId}. Please try again.`);
        } finally {
            setIsProcessingUpgrade(false);
        }
    };

    // --- Render Logic --- 
    if (isLoading) {
        return <p>Loading subscription options...</p>;
    }

    if (error) {
        return <p style={{ color: 'red' }}>{error}</p>;
    }

    return (
        <div className="subscription-manager" style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px' }}>
            <h2>Subscription Tiers</h2>
            <p>Support the platform and unlock benefits by upgrading your tier!</p>
            
            <div className="tier-list" style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                {availableTiers.map((tier) => (
                    <div key={tier.id} className="tier-card" style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px', flex: 1 }}>
                        <h3>{tier.name}</h3>
                        <p style={{ fontSize: '1.2em', fontWeight: 'bold' }}>
                            ${tier.price} / month
                        </p>
                        <ul>
                            {tier.features.map((feature, index) => (
                                <li key={index}>{feature}</li>
                            ))}
                        </ul>
                        <div style={{ marginTop: '15px' }}>
                            {currentUserTier === tier.id ? (
                                <button disabled style={{ backgroundColor: '#ccc' }}>Current Plan</button>
                            ) : (
                                <button 
                                    onClick={() => handleUpgradeClick(tier.id)}
                                    disabled={isProcessingUpgrade || currentUserTier === tier.id} // Disable if processing or already on this tier
                                >
                                    {isProcessingUpgrade ? 'Processing...' : `Upgrade to ${tier.name}`}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <p style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
                Note: Payment processing is currently mocked. Full integration requires backend setup and a payment provider like Stripe.
            </p>
        </div>
    );
};

export default SubscriptionManager;
