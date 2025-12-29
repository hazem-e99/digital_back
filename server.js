/**
 * Stripe Payment Backend Server
 * ==============================
 * This server handles:
 * 1. Creating Stripe Checkout Sessions
 * 2. Verifying payment sessions
 * 3. Handling Stripe Webhooks for reliable payment confirmation
 * 4. Server-Side Conversion Tracking (Meta & TikTok)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const https = require('https');

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ============================================
// CONFIGURATION
// ============================================
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Marketing Pixel Configuration
const META_PIXEL_ID = process.env.META_PIXEL_ID || '3501339013363307';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const TIKTOK_PIXEL_ID = process.env.TIKTOK_PIXEL_ID || 'D56N4F3C77U9GK0PGLUG';
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

// Product configuration
const PRODUCTS = [
  {
    name: process.env.PRODUCT_1_NAME || '35 مليون منتج رقمي',
    url: process.env.PRODUCT_1_URL || '/products/35-Million-Products.pdf.pdf-mayswj.pdf',
    icon: '📦',
    description: 'مجموعة ضخمة من المنتجات الرقمية',
    color: 'green'
  },
  {
    name: process.env.PRODUCT_2_NAME || 'مليون منتج PDF',
    url: process.env.PRODUCT_2_URL || '/products/million-digital-products-pdf.pdf-bqs5yz.pdf',
    icon: '📚',
    description: 'كتب ومستندات PDF جاهزة',
    color: 'purple'
  },
  {
    name: process.env.PRODUCT_3_NAME || 'الكورسات الهدية',
    url: process.env.PRODUCT_3_URL || '/products/الكورسات-الهدية-فقط.pdf.pdf-hu51he.pdf',
    icon: '🎁',
    description: 'كورسات تعليمية مجانية',
    color: 'pink'
  }
];

// ============================================
// SERVER-SIDE TRACKING FUNCTIONS
// ============================================

/**
 * Send Purchase event to Meta Conversions API
 * This is 100% reliable - doesn't depend on browser
 */
async function trackMetaPurchase(eventData) {
  if (!META_ACCESS_TOKEN) {
    console.log('⚠️ Meta Access Token not configured, skipping Meta tracking');
    return;
  }

  const url = `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`;
  
  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: eventData.source_url || FRONTEND_URL,
      user_data: {
        em: eventData.email ? hashData(eventData.email.toLowerCase()) : undefined,
        client_ip_address: eventData.ip_address,
        client_user_agent: eventData.user_agent,
      },
      custom_data: {
        currency: eventData.currency || 'USD',
        value: eventData.value || 14.00,
        content_type: 'product',
        content_name: 'Digital Products Bundle',
        content_ids: ['digital_bundle'],
        num_items: 1,
        order_id: eventData.order_id
      }
    }],
    access_token: META_ACCESS_TOKEN
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.events_received) {
      console.log('✅ Meta Conversions API: Purchase tracked successfully!');
      console.log('   Events received:', result.events_received);
    } else {
      console.log('⚠️ Meta Conversions API response:', result);
    }
  } catch (error) {
    console.error('❌ Meta Conversions API error:', error.message);
  }
}

/**
 * Send Purchase event to TikTok Events API
 * This is 100% reliable - doesn't depend on browser
 */
async function trackTikTokPurchase(eventData) {
  if (!TIKTOK_ACCESS_TOKEN) {
    console.log('⚠️ TikTok Access Token not configured, skipping TikTok tracking');
    return;
  }

  const url = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
  
  const payload = {
    pixel_code: TIKTOK_PIXEL_ID,
    event: 'CompletePayment',
    event_id: eventData.order_id || `order_${Date.now()}`,
    timestamp: new Date().toISOString(),
    context: {
      user_agent: eventData.user_agent,
      ip: eventData.ip_address,
    },
    properties: {
      currency: eventData.currency || 'USD',
      value: eventData.value || 14.00,
      content_type: 'product',
      content_id: 'digital_bundle',
      content_name: 'Digital Products Bundle',
      quantity: 1
    },
    user: {
      email: eventData.email ? hashData(eventData.email.toLowerCase()) : undefined,
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': TIKTOK_ACCESS_TOKEN
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.code === 0) {
      console.log('✅ TikTok Events API: Purchase tracked successfully!');
    } else {
      console.log('⚠️ TikTok Events API response:', result);
    }
  } catch (error) {
    console.error('❌ TikTok Events API error:', error.message);
  }
}

/**
 * Hash data for privacy (required by Meta/TikTok)
 */
function hashData(data) {
  if (!data) return undefined;
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Track purchase on all platforms
 */
async function trackPurchaseServerSide(session, req) {
  const eventData = {
    email: session.customer_details?.email,
    value: (session.amount_total || 1400) / 100,
    currency: (session.currency || 'usd').toUpperCase(),
    order_id: session.id,
    source_url: `${FRONTEND_URL}/success`,
    ip_address: req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown',
    user_agent: req?.headers?.['user-agent'] || 'unknown'
  };

  console.log('🎯 Starting Server-Side Tracking...');
  console.log('   Order ID:', eventData.order_id);
  console.log('   Value:', eventData.value, eventData.currency);
  console.log('   Email:', eventData.email ? '***@***' : 'Not provided');

  // Track on both platforms in parallel
  await Promise.all([
    trackMetaPurchase(eventData),
    trackTikTokPurchase(eventData)
  ]);

  console.log('🎯 Server-Side Tracking completed!');
}

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration
app.use(cors({
  origin: [
    FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    /\.vercel\.app$/  // Allow all Vercel preview deployments
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

// Trust proxy for IP address
app.set('trust proxy', true);

// Webhook endpoint needs raw body
app.use('/webhook', express.raw({ type: 'application/json' }));

// JSON parser for other routes
app.use(express.json());

// ============================================
// API ROUTES
// ============================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    tracking: {
      meta: META_ACCESS_TOKEN ? 'configured' : 'not configured',
      tiktok: TIKTOK_ACCESS_TOKEN ? 'configured' : 'not configured'
    }
  });
});

/**
 * Create a Stripe Checkout Session
 * This is the secure way to initiate payment
 */
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    console.log('📦 Creating checkout session...');
    
    // Get the origin from the request or use default
    const origin = req.headers.origin || FRONTEND_URL;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      // Collect customer email
      customer_creation: 'always',
      // Additional metadata
      metadata: {
        source: 'website',
        created_at: new Date().toISOString()
      }
    });

    console.log('✅ Checkout session created:', session.id);
    
    res.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: error.message 
    });
  }
});

/**
 * Verify a Stripe Checkout Session
 * Called from the success page to confirm payment
 */
app.get('/api/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ 
        paid: false, 
        error: 'Session ID is required' 
      });
    }

    console.log('🔍 Verifying session:', session_id);

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log('📋 Session status:', session.payment_status);

    if (session.payment_status === 'paid') {
      console.log('✅ Payment verified for session:', session_id);
      
      // Return products only if payment is confirmed
      res.json({
        paid: true,
        customer_email: session.customer_details?.email || null,
        amount_total: session.amount_total,
        currency: session.currency,
        products: PRODUCTS
      });
    } else {
      console.log('❌ Payment not completed for session:', session_id);
      res.json({ 
        paid: false,
        status: session.payment_status 
      });
    }
  } catch (error) {
    console.error('❌ Error verifying session:', error);
    
    // Check if it's an invalid session ID
    if (error.code === 'resource_missing') {
      return res.status(404).json({ 
        paid: false, 
        error: 'Session not found' 
      });
    }
    
    res.status(500).json({ 
      paid: false, 
      error: 'Failed to verify session' 
    });
  }
});

/**
 * Stripe Webhook Handler
 * This endpoint receives events from Stripe (payment completed, refunded, etc.)
 * THIS IS WHERE SERVER-SIDE TRACKING HAPPENS - 100% RELIABLE!
 */
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  // If webhook secret is not set (development), try to parse directly
  if (!webhookSecret || webhookSecret === 'whsec_placeholder') {
    try {
      event = JSON.parse(req.body.toString());
      console.log('⚠️ Webhook signature verification skipped (no secret configured)');
    } catch (err) {
      console.error('⚠️ Failed to parse webhook body:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    try {
      // Verify the webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  console.log('📨 Webhook received:', event.type);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('✅ Payment successful!');
      console.log('   Session ID:', session.id);
      console.log('   Customer Email:', session.customer_details?.email);
      console.log('   Amount:', session.amount_total / 100, session.currency.toUpperCase());
      
      // 🎯 SERVER-SIDE TRACKING - This is the most reliable way!
      // Tracking happens here regardless of what happens on the client side
      await trackPurchaseServerSide(session, req);
      
      break;

    case 'checkout.session.expired':
      console.log('⏰ Checkout session expired:', event.data.object.id);
      break;

    case 'payment_intent.payment_failed':
      console.log('❌ Payment failed:', event.data.object.id);
      break;

    default:
      console.log(`📩 Unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
});

/**
 * Get product list (for testing)
 */
app.get('/api/products', (req, res) => {
  res.json({ products: PRODUCTS });
});

/**
 * Manual tracking endpoint (for testing)
 */
app.post('/api/track-purchase', async (req, res) => {
  const { email, value, currency, order_id } = req.body;
  
  const mockSession = {
    id: order_id || `test_${Date.now()}`,
    customer_details: { email },
    amount_total: (value || 14) * 100,
    currency: currency || 'usd'
  };
  
  await trackPurchaseServerSide(mockSession, req);
  
  res.json({ success: true, message: 'Tracking events sent' });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log('🚀 Stripe Backend Server Started!');
  console.log('🚀 ================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
  console.log(`💳 Stripe Mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'LIVE' : 'TEST'}`);
  console.log('');
  console.log('📊 Server-Side Tracking:');
  console.log(`   Meta Pixel: ${META_ACCESS_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   TikTok Pixel: ${TIKTOK_ACCESS_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
  console.log('');
  console.log('📚 Available Endpoints:');
  console.log('   GET  /health                    - Health check');
  console.log('   POST /api/create-checkout-session - Create payment session');
  console.log('   GET  /api/verify-session        - Verify payment');
  console.log('   POST /webhook                   - Stripe webhooks + tracking');
  console.log('   GET  /api/products              - Get product list');
  console.log('   POST /api/track-purchase        - Manual tracking (testing)');
  console.log('');
});

module.exports = app;
