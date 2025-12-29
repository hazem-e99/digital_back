# Stripe Backend

Backend server for handling Stripe payments with full API integration.

## Features

- ✅ Secure Checkout Session creation
- ✅ Payment verification before showing downloads
- ✅ Webhook support for reliable payment confirmation
- ✅ CORS configured for frontend integration

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy the example env file and fill in your Stripe credentials:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_PRICE_ID=price_xxxxxxxxxxxxx
FRONTEND_URL=https://your-frontend.vercel.app
```

### 3. Run the Server

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/create-checkout-session` | Create Stripe Checkout Session |
| GET | `/api/verify-session?session_id=xxx` | Verify payment status |
| POST | `/webhook` | Stripe webhook handler |
| GET | `/api/products` | Get product list |

## Deployment to Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Set the build command: `npm install`
4. Set the start command: `npm start`
5. Add environment variables in Render dashboard
6. Deploy!

## Setting up Stripe Webhook

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-backend.onrender.com/webhook`
3. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
4. Copy the webhook signing secret to your `.env` file

## Testing

Use Stripe test mode with test cards:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
