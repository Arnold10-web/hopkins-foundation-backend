import express from 'express';

const router = express.Router();

console.log('📊 Stats route file loaded successfully');

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Stats route is working!',
    timestamp: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// Live donation/impact endpoints have been intentionally DISABLED.
//
// The frontend real-time donation tracker (SocialProofTicker) and the
// "Measuring Real Change" live impact dashboard (ImpactStats) were removed
// from the site. These two endpoints were their only consumers, so they are
// now severed from the frontend. They return a clean 410 Gone instead of
// stale/mock data, keeping the rest of the backend logic completely untouched.
// ---------------------------------------------------------------------------
router.get('/live-stats', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'Live impact statistics endpoint has been disabled',
    message: 'This real-time endpoint is no longer available.'
  });
});

router.get('/social-proof', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'Social proof ticker endpoint has been disabled',
    message: 'This real-time endpoint is no longer available.'
  });
});

export default router;