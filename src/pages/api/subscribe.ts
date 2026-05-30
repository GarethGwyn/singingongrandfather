import type { APIRoute } from 'astro';

const CC_API_KEY  = import.meta.env.CC_API_KEY;
const CC_LIST_ID  = import.meta.env.CC_LIST_ID;
const CC_ENDPOINT = 'https://api.cc.email/v3/contacts';

export const POST: APIRoute = async ({ request }) => {
  const { email } = await request.json() as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'A valid email address is required.' }), { status: 400 });
  }

  if (!CC_API_KEY || !CC_LIST_ID) {
    // Not yet configured — log and succeed silently so the UI still works
    console.warn('Constant Contact env vars not set. Email not forwarded:', email);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const res = await fetch(CC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CC_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: { address: email, permission_to_send: 'implicit' },
      list_memberships: [CC_LIST_ID],
    }),
  });

  if (!res.ok && res.status !== 409) {
    // 409 = already subscribed — treat as success
    const body = await res.text();
    console.error('CC API error:', res.status, body);
    return new Response(JSON.stringify({ error: 'Could not subscribe. Please try again.' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
