import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY as string);

const INTERVAL_MAP: Record<string, { interval: 'day' | 'week' | 'month' | 'year'; interval_count: number }> = {
  Weekly:    { interval: 'week',  interval_count: 1 },
  Monthly:   { interval: 'month', interval_count: 1 },
  Quarterly: { interval: 'month', interval_count: 3 },
  Annual:    { interval: 'year',  interval_count: 1 },
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { amount, frequency, coverFee } = await request.json() as {
      amount: number;
      frequency: string;
      coverFee: boolean;
    };

    const baseAmountCents = Math.round(Number(amount) * 100);
    if (!baseAmountCents || baseAmountCents < 50) {
      return new Response(JSON.stringify({ error: 'Minimum donation is $0.50' }), { status: 400 });
    }

    // Add 3% fee on top if donor opts to cover it
    const unitAmount = coverFee
      ? Math.round(baseAmountCents * 1.03)
      : baseAmountCents;

    const isRecurring = frequency !== 'One-Time';
    const origin = new URL(request.url).origin;

    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: unitAmount,
        product_data: {
          name: 'Singing on Grandfather — General Fund',
          description: isRecurring
            ? `${frequency} donation${coverFee ? ' (includes processing fee)' : ''}`
            : `One-time donation${coverFee ? ' (includes processing fee)' : ''}`,
        },
        ...(isRecurring
          ? { recurring: INTERVAL_MAP[frequency] }
          : {}),
      },
    };

    const session = await stripe.checkout.sessions.create({
      mode: isRecurring ? 'subscription' : 'payment',
      line_items: [lineItem],
      success_url: `${origin}/supporters?donated=true&freq=${encodeURIComponent(frequency)}&amt=${amount}`,
      cancel_url: `${origin}/supporters?cancelled=true`,
      billing_address_collection: 'required',
      customer_creation: isRecurring ? undefined : 'always',
      metadata: { frequency, coverFee: String(coverFee) },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
};
