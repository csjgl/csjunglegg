export default function handler(req, res) {
  // Construct the Steam OpenID login URL
  const returnUrl = `${process.env.ORIGIN || 'https://csjunglegg.vercel.app'}/api/auth-steam-callback`;
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnUrl,
    'openid.realm': process.env.ORIGIN || 'https://csjunglegg.vercel.app',
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  const steamLoginUrl = `https://steamcommunity.com/openid/login?${params.toString()}`;
  res.writeHead(302, { Location: steamLoginUrl });
  res.end();
}
