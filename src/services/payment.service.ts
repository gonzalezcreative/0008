import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export class PaymentService {
  async createPaymentSession(leadId: string, amount: number) {
    try {
      // Create a payment record in Firestore
      const paymentRef = await addDoc(collection(db, 'payments'), {
        leadId,
        amount: amount * 100, // Convert to cents
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to initialize');

      // Create Stripe Checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId,
          paymentId: paymentRef.id,
          amount: amount * 100
        }),
      });

      const session = await response.json();

      if (session.error) {
        throw new Error(session.error);
      }

      // Update payment record with session ID
      await updateDoc(doc(db, 'payments', paymentRef.id), {
        sessionId: session.id
      });

      // Redirect to Stripe Checkout
      const result = await stripe.redirectToCheckout({
        sessionId: session.id
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return session;
    } catch (error: any) {
      console.error('Payment error:', error);
      throw new Error(error.message || 'Payment processing failed');
    }
  }

  async handlePaymentSuccess(sessionId: string) {
    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error);
      }

      return result;
    } catch (error: any) {
      console.error('Payment verification error:', error);
      throw new Error(error.message || 'Payment verification failed');
    }
  }
}