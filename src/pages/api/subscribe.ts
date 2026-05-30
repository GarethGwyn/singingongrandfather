import type { APIRoute } from 'astro';

const CC_ENDPOINT = 'https://api.cc.email/v3/contacts';

async function getAccessToken(): Promise<string> {
  const token = import.meta.env.CC_API_KEY;
  return token;
}

async function refreshAccessToken(): Promise<string | null> {
  const clientId     = import.meta.env.CC_CLIENT_ID;
  const clientSecret = import.meta.env.CC_CLIENT_SECRET;
  const refreshToken = import.meta.env.CC_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch('https://authz.constantcontact.com/oauth2/default/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

async function addContact(email: string, token: string): Promise<Response> {
  const listId = import.meta.env.CC_LIST_ID;
  return fetch(CC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: { address: email, permission_to_send: 'implicit' },
      create_source: 'Account',
      list_memberships: [listId],
    }),
  });
}

export const POST: APIRoute = async ({ request }) => {
  const { email } = await request.json() as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'A valid email address is required.' }), { status: 400 });
  }

  const ccApiKey = import.meta.env.CC_API_KEY;
  if (!ccApiKey || !import.meta.env.CC_LIST_ID) {
    console.warn('CC env vars not set. Email not forwarded:', email);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  let token = await getAccessToken();
  let res = await addContact(email, token);

  // If expired, try refreshing once
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = refreshed;
      res = await addContact(email, token);
    }
  }

  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    console.error('CC API error:', res.status, body);
    return new Response(JSON.stringify({ error: 'Could not subscribe. Please try again.' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
