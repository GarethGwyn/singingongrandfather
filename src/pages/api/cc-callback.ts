import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('No code in callback.', { status: 400 });
  }

  const clientId     = import.meta.env.CC_CLIENT_ID;
  const clientSecret = import.meta.env.CC_CLIENT_SECRET;
  const redirectUri  = `${url.origin}/api/cc-callback`;

  const tokenRes = await fetch('https://authz.constantcontact.com/oauth2/default/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await tokenRes.json() as Record<string, string>;

  if (!tokenRes.ok) {
    return new Response(`Token exchange failed: ${JSON.stringify(data)}`, { status: 500 });
  }

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>CC Token</title>
<style>body{font-family:monospace;padding:40px;max-width:800px;margin:0 auto}
pre{background:#f4f4f4;padding:20px;border-radius:8px;overflow-wrap:break-word;white-space:pre-wrap}
h2{color:#1a1a1a}p{color:#555}</style>
</head>
<body>
<h2>Constant Contact Access Token</h2>
<p>Copy the <strong>access_token</strong> below — add it to Vercel as <code>CC_API_KEY</code>.</p>
<pre>${JSON.stringify(data, null, 2)}</pre>
<p style="margin-top:24px;color:#888;font-size:13px">You can delete this page after setup is complete.</p>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
};
