import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.STREAM_LISTER_PORT || 3002;

app.use(cors()); // Enable CORS for all routes
app.use(express.json());

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_CUSTOMER_ID = process.env.CLOUDFLARE_CUSTOMER_ID; // For thumbnail URLs

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_CUSTOMER_ID) {
  console.error('Missing required Cloudflare environment variables!');
  // In a real production app, you might exit or have more robust error handling
}

// Endpoint to get live streams
app.get('/api/live-streams', async (req, res) => {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_CUSTOMER_ID) {
    return res.status(500).json({ error: 'Server configuration error: Missing Cloudflare credentials.' });
  }

  const cloudflareApiUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs?status=live`;

  try {
    const response = await fetch(cloudflareApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Cloudflare API error: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Failed to fetch live inputs from Cloudflare: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      console.error('Cloudflare API call not successful:', data.errors);
      throw new Error('Cloudflare API reported an error.');
    }

    const liveStreams = data.result.map(liveInput => {
      // Prioritize metadata from the 'meta' field of the live input
      const streamerName = liveInput.meta?.streamerName || liveInput.meta?.name || 'Unknown Streamer';
      const gameName = liveInput.meta?.gameName || 'Unknown Game';
      
      return {
        id: liveInput.uid, // This is the Video UID, good for playback and thumbnails
        streamerName: streamerName,
        gameName: gameName,
        viewerCount: liveInput.status?.currentViewers || 0, // Note: viewerCount for live_inputs might not be readily available or accurate without specific setup
        genres: liveInput.meta?.genres || [], // Expect genres as an array in meta
        thumbnailUrl: `https://${CLOUDFLARE_CUSTOMER_ID}.cloudflarestream.com/${liveInput.uid}/thumbnails/thumbnail.jpg`,
        isLive: true, // We filtered by status=live, so these should be live
        avatarSeed: liveInput.meta?.avatarSeed || liveInput.uid // For DiceBear avatar consistency
      };
    });

    res.json(liveStreams);

  } catch (error) {
    console.error('Error fetching or processing live streams:', error);
    res.status(500).json({ error: 'Failed to retrieve live streams.', details: error.message });
  }
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Clipt Stream Lister Service running on http://localhost:${PORT}`);
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_CUSTOMER_ID) {
    console.warn('Warning: Cloudflare environment variables are not set. The /api/live-streams endpoint will not function correctly.');
  }
});
