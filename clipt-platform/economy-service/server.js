import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.ECONOMY_SERVICE_PORT || 3004; // New port for this service

app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Use anon key for client-side, service_role for backend

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/healthz', (req, res) => {
  res.status(200).send('Clipt Economy Service is healthy!');
});

// --- User Profile & Tier Endpoints ---

// Fetch user's tier and token balance
app.get('/api/users/:userId/profile', async (req, res) => {
  const { userId } = req.params;

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('user_id, tier, token_balance, wallet_cap, daily_token_limit')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { 
        return res.status(404).json({ error: 'User profile not found' });
      } else {
        console.error('Error fetching user profile:', error); 
        return res.status(500).json({ error: 'Internal server error fetching profile data', details: error.message });
      }
    }

    return res.json({
        userId: profile.user_id,
        tier: profile.tier,
        tokenBalance: profile.token_balance,
        walletCap: profile.wallet_cap,
        dailyTokenLimit: profile.daily_token_limit
    });

  } catch (err) {
    console.error('Unexpected error in /profile endpoint:', err);
    return res.status(500).json({ error: 'An unexpected server error occurred' }); 
  }
});

// Define activities and their token rewards
const ACTIVITY_REWARDS = {
  // Primary activities from the spec
  post_clip: 2,             // Post a clip → +2 tokens
  go_live: 3,               // Go live → +3 tokens
  ten_likes_on_post: 2,     // 10 likes on a post → +2 tokens
  comment_five_times: 1,    // Comment 5x/day → +1 token
  watch_ten_clips: 2,       // Watch 10 clips → +2 tokens
  subscriber_streak: 5,     // Subscriber Streak → +Token bonuses (value TBD)
  
  // Legacy activities (keeping for backward compatibility)
  upload_clip: 2,           // Same as post_clip
  watch_stream_segment: 1,  // Partial credit toward watch_ten_clips
  receive_like: 1,          // Partial credit toward ten_likes_on_post
  daily_login: 2,           // Daily engagement bonus
  share_clip: 3             // Social sharing bonus
};

// Define tier-based settings
const TIER_SETTINGS = {
  free: {
    dailyTokenLimit: 10,
    walletCap: 200,
    monthlyBonus: 0,
    freeBoosts: {}
  },
  pro: {
    dailyTokenLimit: 20,
    walletCap: 400,
    monthlyBonus: 100,
    freeBoosts: {
      squad_blast: 1  // 1 free Squad Blast per week
    }
  },
  maxed: {
    dailyTokenLimit: 30,
    walletCap: 800,
    monthlyBonus: 300,
    freeBoosts: {
      any: 1  // 1 free boost of choice per week
    }
  }
};

// Define boost types, costs, and effects
const BOOST_TYPES = {
  squad_blast: {
    cost: 40,
    name: "Squad Blast",
    effect: "Push your clip to your top 25 friends' squads clipts page feed for the day",
    discountByTier: {
      pro: 0.10,    // 10% discount for Pro users
      maxed: 0.25  // 25% discount for Maxed users
    }
  },
  chain_reaction: {
    cost: 60,
    name: "Chain Reaction",
    effect: "Each like/comment/share spreads your clip to 5 more users for 6 hours (stackable)",
    discountByTier: {
      pro: 0.10,    // 10% discount for Pro users
      maxed: 0.25  // 25% discount for Maxed users
    }
  },
  im_the_king_now: {
    cost: 80,
    name: "I'm the King Now",
    effect: "Place your stream in top page of the stream category for 2 hours",
    discountByTier: {
      pro: 0.10,    // 10% discount for Pro users
      maxed: 0.25  // 25% discount for Maxed users
    }
  },
  stream_surge: {
    cost: 50,
    name: "Stream Surge",
    effect: "Push your stream to 200+ active viewers in your genre for 30 mins + trending badge",
    discountByTier: {
      pro: 0.10,    // 10% discount for Pro users
      maxed: 0.25  // 25% discount for Maxed users
    }
  }
};

// Endpoint for users to earn tokens via activities
app.post('/api/users/:userId/activity', async (req, res) => {
  const { userId } = req.params;
  const { activityType, itemId } = req.body; // itemId is optional, e.g., clip_id

  if (!activityType) {
    return res.status(400).json({ error: 'Activity type is required' });
  }

  const rewardAmount = ACTIVITY_REWARDS[activityType];
  if (rewardAmount === undefined) {
    return res.status(400).json({ error: 'Invalid activity type' });
  }

  if (rewardAmount <= 0) {
    return res.status(400).json({ error: 'Activity has no reward or a non-positive reward.' });
  }

  try {
    // 1. Fetch user's profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, tier, token_balance, wallet_cap, daily_token_limit')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return res.status(404).json({ error: 'User profile not found' });
      }
      console.error('Error fetching profile for activity:', profileError);
      return res.status(500).json({ error: 'Could not fetch user profile for activity processing' });
    }

    // 2. Calculate tokens earned today
    const todayUTCStart = new Date();
    todayUTCStart.setUTCHours(0, 0, 0, 0);
    const tomorrowUTCStart = new Date(todayUTCStart);
    tomorrowUTCStart.setUTCDate(todayUTCStart.getUTCDate() + 1);

    const { data: todaysTransactions, error: transactionsError } = await supabase
      .from('token_transactions')
      .select('change_amount')
      .eq('user_id', userId)
      .gte('created_at', todayUTCStart.toISOString())
      .lt('created_at', tomorrowUTCStart.toISOString());

    if (transactionsError) {
      console.error('Error fetching today\'s transactions:', transactionsError);
      return res.status(500).json({ error: 'Could not verify daily earnings' });
    }

    const tokensEarnedToday = todaysTransactions.reduce((sum, tx) => sum + tx.change_amount, 0);

    // 3. Check daily limit
    if (profile.daily_token_limit > 0 && (tokensEarnedToday + rewardAmount) > profile.daily_token_limit) {
      const remainingDailyAllowance = Math.max(0, profile.daily_token_limit - tokensEarnedToday);
      if (remainingDailyAllowance === 0) {
        return res.status(403).json({ 
            error: 'Daily token earning limit reached.',
            currentBalance: profile.token_balance,
            tokensEarnedToday: tokensEarnedToday,
            dailyLimit: profile.daily_token_limit
        });
      }
      // Potentially award partial tokens if desired, for now, we deny if full reward exceeds.
      // For a more complex system, one might award Math.min(rewardAmount, remainingDailyAllowance)
      // but this means the rewardAmount for the activity isn't fully granted.
      // Sticking to simpler: if full reward makes it exceed, then it's 'limit reached for this activity'
       return res.status(403).json({ 
            error: `Cannot award full ${rewardAmount} tokens. Earning this would exceed daily limit of ${profile.daily_token_limit}. Tokens earned today: ${tokensEarnedToday}.`,
            currentBalance: profile.token_balance
        });
    }

    // 4. Determine actual tokens to award, considering wallet cap
    let tokensToAward = rewardAmount;
    const potentialNewBalance = profile.token_balance + tokensToAward;

    if (potentialNewBalance > profile.wallet_cap) {
      tokensToAward = Math.max(0, profile.wallet_cap - profile.token_balance);
    }
    
    if (tokensToAward <= 0 && rewardAmount > 0) { // Wallet is full or reward got reduced to 0 by cap
        return res.status(403).json({
            error: 'Wallet cap reached or reward reduced to zero by cap. Cannot earn more tokens at this time.',
            currentBalance: profile.token_balance,
            walletCap: profile.wallet_cap
        });
    }
    if (tokensToAward === 0 && rewardAmount === 0) { // Should have been caught by rewardAmount <=0 check, but defensive
        return res.status(200).json({
            message: 'Activity has no reward value.',
            currentBalance: profile.token_balance
        });
    }

    // 5. Update user's token_balance and log transaction
    const newBalance = profile.token_balance + tokensToAward;

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ token_balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating token balance:', updateError);
      return res.status(500).json({ error: 'Failed to update token balance' });
    }

    // 6. Log transaction
    const transactionDescription = `Earned ${tokensToAward} tokens for ${activityType}`;
    const { error: logError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        change_amount: tokensToAward,
        new_balance: newBalance,
        reason: transactionDescription,
        related_id: activityType
      });

    if (logError) {
      console.error('Error logging token transaction:', logError);
      // Note: Balance was updated, but logging failed. This is a critical state.
      // Ideally, this would be in a DB transaction. For now, log critical error.
      // Consider mechanisms to reconcile later or alert.
      return res.status(500).json({ error: 'Tokens awarded but failed to log transaction. Please report this.' });
    }

    return res.status(200).json({
      message: 'Activity processed successfully.',
      tokensAwarded: tokensToAward,
      newBalance: newBalance,
      tokensEarnedToday: tokensEarnedToday + tokensToAward,
      dailyLimit: profile.daily_token_limit,
      walletCap: profile.wallet_cap
    });

  } catch (err) {
    console.error('Unexpected error processing activity:', err);
    return res.status(500).json({ error: 'An unexpected server error occurred while processing activity' });
  }
});

// --- Tier Management Endpoints (Example Stubs) ---
app.get('/api/tiers', (req, res) => {
  res.status(501).json({ message: 'Not Implemented: Get all tiers' });
});

// ===== TEST ROUTES (Development Only) =====
// Direct browser-accessible route to test token earning
// DO NOT USE IN PRODUCTION - This is for development testing only!
// Test route for earning tokens
app.get('/test/activity/:userId/:activityType', async (req, res) => {
  try {
    const { userId, activityType } = req.params;
    
    console.log(`[TEST] Testing activity: ${activityType} for user: ${userId}`);
    
    if (!ACTIVITY_REWARDS[activityType]) {
      return res.status(400).json({ error: `Invalid activity type: ${activityType}. Valid types are: ${Object.keys(ACTIVITY_REWARDS).join(', ')}` });
    }
    
    // 1. Fetch user's profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, tier, token_balance, wallet_cap, daily_token_limit')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return res.status(404).json({ error: 'User profile not found' });
      }
      console.error('[TEST] Error fetching profile:', profileError);
      return res.status(500).json({ error: 'Could not fetch user profile' });
    }

    // 2. Calculate tokens earned today
    const todayUTCStart = new Date();
    todayUTCStart.setUTCHours(0, 0, 0, 0);
    const tomorrowUTCStart = new Date(todayUTCStart);
    tomorrowUTCStart.setUTCDate(todayUTCStart.getUTCDate() + 1);

    const { data: todaysTransactions, error: transactionsError } = await supabase
      .from('token_transactions')
      .select('change_amount')
      .eq('user_id', userId)
      .gte('created_at', todayUTCStart.toISOString())
      .lt('created_at', tomorrowUTCStart.toISOString());

    if (transactionsError) {
      console.error('[TEST] Error fetching today\'s transactions:', transactionsError);
      return res.status(500).json({ error: 'Could not verify daily earnings' });
    }

    const tokensEarnedToday = todaysTransactions.reduce((sum, tx) => sum + tx.change_amount, 0);
    const rewardAmount = ACTIVITY_REWARDS[activityType];
    
    // Get tier-specific settings
    const tierSettings = TIER_SETTINGS[profile.tier] || TIER_SETTINGS.free;
    const effectiveDailyLimit = profile.daily_token_limit || tierSettings.dailyTokenLimit;
    const effectiveWalletCap = profile.wallet_cap || tierSettings.walletCap;
    
    // 3. Check daily limit
    if (effectiveDailyLimit > 0 && (tokensEarnedToday + rewardAmount) > effectiveDailyLimit) {
      const remainingDailyAllowance = Math.max(0, effectiveDailyLimit - tokensEarnedToday);
      if (remainingDailyAllowance === 0) {
        return res.status(403).json({ 
            error: 'Daily token earning limit reached.',
            currentBalance: profile.token_balance,
            tokensEarnedToday: tokensEarnedToday,
            dailyLimit: effectiveDailyLimit,
            tier: profile.tier
        });
      }
      return res.status(403).json({ 
        error: `Cannot award full ${rewardAmount} tokens. Earning this would exceed daily limit.`,
        currentBalance: profile.token_balance,
        tokensEarnedToday: tokensEarnedToday,
        dailyLimit: effectiveDailyLimit,
        tier: profile.tier
      });
    }

    // 4. Determine actual tokens to award, considering wallet cap
    let tokensToAward = rewardAmount;
    const potentialNewBalance = profile.token_balance + tokensToAward;

    if (potentialNewBalance > effectiveWalletCap) {
      tokensToAward = Math.max(0, effectiveWalletCap - profile.token_balance);
    }
    
    if (tokensToAward <= 0) {
      return res.status(403).json({
        error: 'Wallet cap reached. Cannot earn more tokens at this time.',
        currentBalance: profile.token_balance,
        walletCap: effectiveWalletCap,
        tier: profile.tier
      });
    }

    // 5. Update user's token_balance
    const newBalance = profile.token_balance + tokensToAward;

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ token_balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[TEST] Error updating token balance:', updateError);
      return res.status(500).json({ error: 'Failed to update token balance' });
    }

    // 6. Log transaction
    const transactionDescription = `Earned ${tokensToAward} Clipt Coins for ${activityType} (TEST ROUTE)`;
    const { error: logError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        change_amount: tokensToAward,   // Use change_amount instead of amount
        new_balance: newBalance,        // Required field
        reason: transactionDescription, // Use reason instead of description
        related_id: activityType        // Use related_id instead of related_activity_type
      });

    if (logError) {
      console.error('[TEST] Error logging token transaction:', logError);
      return res.status(500).json({ 
        error: 'Tokens awarded but failed to log transaction. Please report this.',
        details: logError.message
      });
    }

    return res.status(200).json({
      message: 'TEST: Activity processed successfully.',
      activityType: activityType,
      tokensAwarded: tokensToAward,
      oldBalance: profile.token_balance,
      newBalance: newBalance,
      tokensEarnedToday: tokensEarnedToday + tokensToAward,
      dailyLimit: effectiveDailyLimit,
      walletCap: effectiveWalletCap,
      tier: profile.tier,
      tierSettings: tierSettings
    });
  } catch (err) {
    console.error('[TEST] Unexpected error in test route:', err);
    return res.status(500).json({ 
      error: 'An unexpected server error occurred', 
      details: err.message 
    });
  }
});

// Test route for purchasing boosts
app.get('/test/boost/:userId/:boostType', async (req, res) => {
  try {
    const { userId, boostType } = req.params;
    const targetId = req.query.targetId || null; // Optional content ID to boost
    
    console.log(`[TEST] Testing boost purchase: ${boostType} for user: ${userId}`);
    
    // Validate boost type
    if (!BOOST_TYPES[boostType]) {
      return res.status(400).json({ 
        error: `Invalid boost type: ${boostType}. Valid types are: ${Object.keys(BOOST_TYPES).join(', ')}`,
        validBoosts: Object.keys(BOOST_TYPES) 
      });
    }
    
    // Fetch user's profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, tier, token_balance, wallet_cap, daily_token_limit, free_boosts_used')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('[TEST] Error fetching profile for boost purchase:', profileError);
      return res.status(500).json({ error: 'Could not fetch user profile' });
    }

    // Get tier-specific settings and boost information
    const tierSettings = TIER_SETTINGS[profile.tier] || TIER_SETTINGS.free;
    const boostInfo = BOOST_TYPES[boostType];
    
    // Check if the user has a free boost available
    let useFreeBoost = false;
    const freeBoostsUsed = profile.free_boosts_used || {};
    const currentWeek = getWeekNumber(new Date());
    
    // Initialize the structure if it doesn't exist
    if (!freeBoostsUsed[currentWeek]) {
      freeBoostsUsed[currentWeek] = {};
    }

    // Check if the user has a free boost of this type OR a free 'any' boost
    if (tierSettings.freeBoosts[boostType] && 
        (!freeBoostsUsed[currentWeek][boostType] || 
         freeBoostsUsed[currentWeek][boostType] < tierSettings.freeBoosts[boostType])) {
      useFreeBoost = true;
    } else if (tierSettings.freeBoosts.any && 
               (!freeBoostsUsed[currentWeek].any || 
                freeBoostsUsed[currentWeek].any < tierSettings.freeBoosts.any)) {
      useFreeBoost = true;
    }

    // Calculate boost cost after tier discount, if applicable
    let cost = boostInfo.cost;
    if (!useFreeBoost && boostInfo.discountByTier[profile.tier]) {
      cost = Math.floor(cost * (1 - boostInfo.discountByTier[profile.tier]));
    }

    // If using a free boost, set cost to zero
    if (useFreeBoost) {
      cost = 0;
    }

    // Check if user has enough tokens
    if (profile.token_balance < cost) {
      return res.status(403).json({
        error: 'Insufficient token balance',
        required: cost,
        available: profile.token_balance,
        tier: profile.tier
      });
    }

    // Update the user's token balance
    const newBalance = profile.token_balance - cost;
    
    // Begin transaction
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ 
        token_balance: newBalance,
        free_boosts_used: useFreeBoost ? freeBoostsUsed : profile.free_boosts_used
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('[TEST] Error updating token balance for boost:', updateError);
      return res.status(500).json({ error: 'Failed to update token balance' });
    }

    // Log the transaction
    const boostDescription = `[TEST] Purchased ${boostInfo.name} boost${targetId ? ` for content: ${targetId}` : ''}`;
    
    const { error: logError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        change_amount: -cost, // Negative amount for spending
        new_balance: newBalance,
        reason: boostDescription,
        related_id: boostType,
        target_content_id: targetId || null
      });

    if (logError) {
      console.error('[TEST] Error logging boost transaction:', logError);
      return res.status(500).json({ 
        error: 'Boost purchased but failed to log transaction. Please report this.',
        details: logError.message
      });
    }

    // Track the used free boost if applicable
    if (useFreeBoost) {
      if (tierSettings.freeBoosts[boostType]) {
        freeBoostsUsed[currentWeek][boostType] = (freeBoostsUsed[currentWeek][boostType] || 0) + 1;
      } else {
        freeBoostsUsed[currentWeek].any = (freeBoostsUsed[currentWeek].any || 0) + 1;
      }
      
      // Update the free boosts used tracking
      const { error: boostTrackingError } = await supabase
        .from('user_profiles')
        .update({ free_boosts_used: freeBoostsUsed })
        .eq('user_id', userId);
      
      if (boostTrackingError) {
        console.error('[TEST] Error updating free boost tracking:', boostTrackingError);
      }
    }

    // Return the successful transaction details
    return res.status(200).json({
      message: `TEST: ${boostInfo.name} boost purchased successfully`,
      boostType: boostType,
      boostName: boostInfo.name,
      boostEffect: boostInfo.effect,
      originalCost: boostInfo.cost,
      discountedCost: cost,
      usedFreeBoost: useFreeBoost,
      oldBalance: profile.token_balance,
      newBalance: newBalance,
      targetId: targetId || null,
      tier: profile.tier,
      tierSettings: tierSettings
    });
  } catch (err) {
    console.error('[TEST] Unexpected error in boost test route:', err);
    return res.status(500).json({ 
      error: 'An unexpected server error occurred', 
      details: err.message 
    });
  }
});

// Test route to show all boosts available to a user
app.get('/test/boosts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`[TEST] Getting available boosts for user: ${userId}`);
    
    // Fetch user's profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, tier, token_balance, free_boosts_used')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('[TEST] Error fetching profile for boosts:', profileError);
      return res.status(500).json({ error: 'Could not fetch user profile' });
    }

    // Get tier-specific settings
    const tierSettings = TIER_SETTINGS[profile.tier] || TIER_SETTINGS.free;
    const currentWeek = getWeekNumber(new Date());
    const freeBoostsUsed = profile.free_boosts_used?.[currentWeek] || {};
    
    // Prepare the response with all available boosts
    const boosts = Object.entries(BOOST_TYPES).map(([type, boostInfo]) => {
      // Calculate tier discount if applicable
      const discount = boostInfo.discountByTier[profile.tier] || 0;
      const discountedCost = Math.floor(boostInfo.cost * (1 - discount));
      
      // Check if free boost is available
      let freeBoostAvailable = false;
      
      if (tierSettings.freeBoosts[type]) {
        const used = freeBoostsUsed[type] || 0;
        const limit = tierSettings.freeBoosts[type];
        freeBoostAvailable = used < limit;
      } else if (tierSettings.freeBoosts.any) {
        const used = freeBoostsUsed.any || 0;
        const limit = tierSettings.freeBoosts.any;
        freeBoostAvailable = used < limit;
      }
      
      return {
        type,
        name: boostInfo.name,
        effect: boostInfo.effect,
        originalCost: boostInfo.cost,
        discountedCost,
        discount: discount * 100, // Convert to percentage
        freeBoostAvailable,
        canAfford: profile.token_balance >= discountedCost,
        boostUrlForTesting: `/test/boost/${userId}/${type}`
      };
    });

    return res.status(200).json({
      message: 'TEST: Available boosts',
      boosts,
      currentBalance: profile.token_balance,
      tier: profile.tier,
      tierSettings: tierSettings,
      weeklyFreeBoostsUsed: freeBoostsUsed
    });
  } catch (err) {
    console.error('[TEST] Unexpected error in get boosts test route:', err);
    return res.status(500).json({ 
      error: 'An unexpected server error occurred', 
      details: err.message 
    });
  }
});

// --- Boost Management Endpoints ---
app.post('/api/users/:userId/boost/purchase', async (req, res) => {
  try {
    const { userId } = req.params;
    const { boostType, targetId } = req.body;

    // Validate boost type
    if (!BOOST_TYPES[boostType]) {
      return res.status(400).json({ 
        error: 'Invalid boost type', 
        validBoosts: Object.keys(BOOST_TYPES) 
      });
    }

    // Fetch user's profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, tier, token_balance, wallet_cap, daily_token_limit, free_boosts_used')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile for boost purchase:', profileError);
      return res.status(500).json({ error: 'Could not fetch user profile' });
    }

    // Get tier-specific settings and boost information
    const tierSettings = TIER_SETTINGS[profile.tier] || TIER_SETTINGS.free;
    const boostInfo = BOOST_TYPES[boostType];
    
    // Check if the user has a free boost available
    let useFreeBoost = false;
    const freeBoostsUsed = profile.free_boosts_used || {};
    const currentWeek = getWeekNumber(new Date());
    
    // Initialize the structure if it doesn't exist
    if (!freeBoostsUsed[currentWeek]) {
      freeBoostsUsed[currentWeek] = {};
    }

    // Check if the user has a free boost of this type OR a free 'any' boost
    if (tierSettings.freeBoosts[boostType] && 
        (!freeBoostsUsed[currentWeek][boostType] || 
         freeBoostsUsed[currentWeek][boostType] < tierSettings.freeBoosts[boostType])) {
      useFreeBoost = true;
    } else if (tierSettings.freeBoosts.any && 
               (!freeBoostsUsed[currentWeek].any || 
                freeBoostsUsed[currentWeek].any < tierSettings.freeBoosts.any)) {
      useFreeBoost = true;
    }

    // Calculate boost cost after tier discount, if applicable
    let cost = boostInfo.cost;
    if (!useFreeBoost && boostInfo.discountByTier[profile.tier]) {
      cost = Math.floor(cost * (1 - boostInfo.discountByTier[profile.tier]));
    }

    // If using a free boost, set cost to zero
    if (useFreeBoost) {
      cost = 0;
    }

    // Check if user has enough tokens
    if (profile.token_balance < cost) {
      return res.status(403).json({
        error: 'Insufficient token balance',
        required: cost,
        available: profile.token_balance
      });
    }

    // Update the user's token balance
    const newBalance = profile.token_balance - cost;
    
    // Begin transaction
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ 
        token_balance: newBalance,
        free_boosts_used: useFreeBoost ? freeBoostsUsed : profile.free_boosts_used
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating token balance for boost:', updateError);
      return res.status(500).json({ error: 'Failed to update token balance' });
    }

    // Log the transaction
    const boostDescription = `Purchased ${boostInfo.name} boost${targetId ? ` for content: ${targetId}` : ''}`;
    const transactionType = useFreeBoost ? 'free_boost' : 'boost_purchase';
    
    const { error: logError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: userId,
        change_amount: -cost, // Negative amount for spending
        new_balance: newBalance,
        reason: boostDescription,
        related_id: boostType,
        target_content_id: targetId || null
      });

    if (logError) {
      console.error('Error logging boost transaction:', logError);
      // Don't return an error here, as the balance update was successful
    }

    // Track the used free boost if applicable
    if (useFreeBoost) {
      if (tierSettings.freeBoosts[boostType]) {
        freeBoostsUsed[currentWeek][boostType] = (freeBoostsUsed[currentWeek][boostType] || 0) + 1;
      } else {
        freeBoostsUsed[currentWeek].any = (freeBoostsUsed[currentWeek].any || 0) + 1;
      }
      
      // Update the free boosts used tracking
      const { error: boostTrackingError } = await supabase
        .from('user_profiles')
        .update({ free_boosts_used: freeBoostsUsed })
        .eq('user_id', userId);
      
      if (boostTrackingError) {
        console.error('Error updating free boost tracking:', boostTrackingError);
      }
    }

    // Return the successful transaction details
    return res.status(200).json({
      message: `${boostInfo.name} boost purchased successfully`,
      boostType: boostType,
      boostName: boostInfo.name,
      boostEffect: boostInfo.effect,
      originalCost: boostInfo.cost,
      discountedCost: cost,
      usedFreeBoost: useFreeBoost,
      oldBalance: profile.token_balance,
      newBalance: newBalance,
      targetId: targetId || null
    });
  } catch (err) {
    console.error('Unexpected error in boost purchase:', err);
    return res.status(500).json({ error: 'An unexpected server error occurred' });
  }
});

// Get available boosts for a user
app.get('/api/users/:userId/boosts', async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user's profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, tier, token_balance, free_boosts_used')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile for boosts:', profileError);
      return res.status(500).json({ error: 'Could not fetch user profile' });
    }

    // Get tier-specific settings
    const tierSettings = TIER_SETTINGS[profile.tier] || TIER_SETTINGS.free;
    const currentWeek = getWeekNumber(new Date());
    const freeBoostsUsed = profile.free_boosts_used?.[currentWeek] || {};
    
    // Prepare the response with all available boosts
    const boosts = Object.entries(BOOST_TYPES).map(([type, boostInfo]) => {
      // Calculate tier discount if applicable
      const discount = boostInfo.discountByTier[profile.tier] || 0;
      const discountedCost = Math.floor(boostInfo.cost * (1 - discount));
      
      // Check if free boost is available
      let freeBoostAvailable = false;
      
      if (tierSettings.freeBoosts[type]) {
        const used = freeBoostsUsed[type] || 0;
        const limit = tierSettings.freeBoosts[type];
        freeBoostAvailable = used < limit;
      } else if (tierSettings.freeBoosts.any) {
        const used = freeBoostsUsed.any || 0;
        const limit = tierSettings.freeBoosts.any;
        freeBoostAvailable = used < limit;
      }
      
      return {
        type,
        name: boostInfo.name,
        effect: boostInfo.effect,
        originalCost: boostInfo.cost,
        discountedCost,
        discount: discount * 100, // Convert to percentage
        freeBoostAvailable,
        canAfford: profile.token_balance >= discountedCost,
        tier: profile.tier
      };
    });

    return res.status(200).json({
      boosts,
      currentBalance: profile.token_balance,
      tier: profile.tier
    });
  } catch (err) {
    console.error('Unexpected error in get boosts:', err);
    return res.status(500).json({ error: 'An unexpected server error occurred' });
  }
});

// Helper function to get the current week number (for tracking free boosts)
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// --- Tier Management Endpoints ---
app.post('/api/users/:userId/upgrade-tier', async (req, res) => {
  const { userId } = req.params;
  const { newTier } = req.body; // 'pro' or 'maxed'

  if (!['pro', 'maxed'].includes(newTier)) {
    return res.status(400).json({ error: 'Invalid tier specified' });
  }

  // Process upgrade logic here (e.g., verification, payment processing)
  
  res.status(200).json({ message: `Tier upgrade to ${newTier} processed successfully` });
});

app.get('/api/tiers', (req, res) => {
  res.status(200).json({ 
    tiers: {
      free: {
        name: 'Free',
        price: 0,
        ...TIER_SETTINGS.free
      },
      pro: {
        name: 'Pro (Better)',
        price: 4.99,
        ...TIER_SETTINGS.pro
      },
      maxed: {
        name: 'Maxed (Best)',
        price: 14.99,
        ...TIER_SETTINGS.maxed
      }
    }
  });
});

// --- Boost Endpoints (Example Stubs for later) ---
app.get('/api/boosts', async (req, res) => {
  // TODO: Fetch available boosts and their costs
  res.status(501).json({ message: 'Not Implemented: Get available boosts' });
});

app.post('/api/users/:userId/purchase-boost', async (req, res) => {
  const { userId } = req.params;
  const { boostId } = req.body;
  // TODO: Implement boost purchase logic (deduct tokens, check balance)
  res.status(501).json({ message: 'Not Implemented: Purchase boost', userId, boostId });
});

app.listen(port, () => {
  console.log(`Clipt Economy Service running on http://localhost:${port}`);
});

export default app; // For potential testing or other integrations
