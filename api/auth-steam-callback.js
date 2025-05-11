import jwt from 'jsonwebtoken';
import https from 'https';
import { supabase } from '../src/supabaseClient';

function extractSteamId(claimedId) {
  const match = claimedId && claimedId.match(/\/(\d{17,})$/);
  return match ? match[1] : null;
}

function verifyWithSteam(query) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      'openid.assoc_handle': query['openid.assoc_handle'],
      'openid.signed': query['openid.signed'],
      'openid.sig': query['openid.sig'],
      'openid.ns': query['openid.ns'],
      'openid.mode': 'check_authentication',
      'openid.op_endpoint': query['openid.op_endpoint'],
      'openid.claimed_id': query['openid.claimed_id'],
      'openid.identity': query['openid.identity'],
      'openid.return_to': query['openid.return_to'],
      'openid.response_nonce': query['openid.response_nonce'],
    });
    const options = {
      hostname: 'steamcommunity.com',
      path: '/openid/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': params.toString().length,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (data.includes('is_valid:true')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(params.toString());
    req.end();
  });
}

async function fetchSteamProfile(steamid) {
  // Fetch the real Steam profile using the Steam Web API
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return null;
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamid}`;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.response && json.response.players && json.response.players[0]) {
            resolve(json.response.players[0]);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

export default async function handler(req, res) {
  console.log('Starting Steam login callback handler...');

  try {
    const { query } = req;
    console.log('Received query parameters:', query);

    if (!query || query['openid.mode'] !== 'id_res' || !query['openid.claimed_id']) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    const steamid = extractSteamId(query['openid.claimed_id']);
    console.log('Extracted Steam ID:', steamid);

    if (!steamid) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    const valid = await verifyWithSteam(query);
    console.log('Steam verification result:', valid);

    if (!valid) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    const profile = await fetchSteamProfile(steamid);
    console.log('Fetched Steam profile:', profile);

    if (!profile) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    const steamUser = {
      _json: {
        avatarmedium: profile.avatarmedium,
        personaname: profile.personaname,
      },
      displayName: profile.personaname,
      steamid: profile.steamid,
    };

    const token = jwt.sign(steamUser, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('Generated JWT token:', token);

    // Use Supabase middleware to set the session
    const { error } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: token,
    });

    if (error) {
      console.error('Error initializing Supabase session:', error);
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    console.log('Supabase session initialized successfully.');

    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    console.error('Unexpected error in auth-steam-callback:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
