import { loadStripe, Stripe } from '@stripe/stripe-js';
import { db } from '../config/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export class StripeService {
  private stripe: Promise<Stripe | null>;

  constructor() {
    if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
      throw new Error('Stripe public key is not configured');
    }
    this.stripe = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
  }

  async createPaymentSession(leadId: string, amount: number): Promise<{ sessionId: string; url: string }> {
    try {
      const stripe = await this.stripe;
      if (!stripe) {
        throw new Error('Stripe failed to initialize');
      }

      // Create a payment intent in Firestore
      const paymentsRef = collection(db, 'payments');
      const paymentDoc = await addDoc(paymentsRef, {
        leadId,
        amount: amount * 100, // Convert to cents
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Create Stripe Checkout Session
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
              unit_amount: amount * 100, // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${window.location.origin}/leads?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/leads`,
        metadata: {
          leadId,
          paymentId: paymentDoc.id,
        },
      });

      if (!session.id || !session.url) {
        throw new Error('Invalid session created');
      }

      // Update payment doc with session ID
      await updateDoc(doc(paymentsRef, paymentDoc.id), {
        sessionId: session.id
      });

      return {
        sessionId: session.id,
        url: session.url
      };
    } catch (error) {
      console.error('Error creating payment session:', error);
      throw new Error('Payment session creation failed');
    }
  }

  async processPayment(sessionId: string): Promise<void> {
    const stripe = await this.stripe;
    if (!stripe) {
      throw new Error('Stripe failed to initialize');
    }

    try {
      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({
        sessionId
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Payment error:', error);
      throw new Error('Payment processing failed');
    }
  }

  async recordPayment(userId: string, leadId: string, amount: number): Promise<void> {
    try {
      const leadRef = doc(db, 'leads', leadId);
      await updateDoc(leadRef, {
        purchasedBy: userId,
        purchaseDate: new Date().toISOString(),
        status: 'claimed',
        amount
      });
    } catch (error) {
      console.error('Error recording payment:', error);
      throw new Error('Failed to record payment');
    }
  }
}