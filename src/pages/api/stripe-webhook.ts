import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY as string);
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET as string;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig || !webhookSecret) {
    return new Response('Webhook signature missing', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(`Webhook verification failed: ${message}`, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      // Payment or first subscription charge succeeded
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Donation received:', session.amount_total, session.customer_email);
      break;
    }
    case 'invoice.payment_succeeded': {
      // Recurring subscription renewed
      const invoice = event.data.object as Stripe.Invoice;
      console.log('Subscription renewed:', invoice.amount_paid, invoice.customer_email);
      break;
    }
    case 'invoice.payment_failed': {
      // Subscription renewal failed — Stripe will retry automatically
      const invoice = event.data.object as Stripe.Invoice;
      console.log('Payment failed for:', invoice.customer_email);
      break;
    }
    case 'customer.subscription.deleted': {
      // Donor cancelled their subscription
      const sub = event.data.object as Stripe.Subscription;
      console.log('Subscription cancelled:', sub.id);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
