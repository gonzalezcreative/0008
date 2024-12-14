import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin
initializeApp({
  credential: cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});

const db = getFirestore();

app.use(cors());
app.use(bodyParser.json());

// Create Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { leadId, amount } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Lead Purchase',
              description: `Access to lead details (ID: ${leadId})`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/leads?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/leads`,
      metadata: {
        leadId,
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Verify Payment
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const leadId = session.metadata.leadId;
      
      // Update lead status in Firestore
      await db.collection('leads').doc(leadId).update({
        status: 'claimed',
        purchasedBy: session.customer,
        purchaseDate: new Date().toISOString()
      });

      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Stripe Webhook
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const leadId = session.metadata.leadId;

        // Update lead status in Firestore
        await db.collection('leads').doc(leadId).update({
          status: 'claimed',
          purchasedBy: session.customer,
          purchaseDate: new Date().toISOString()
        });
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});