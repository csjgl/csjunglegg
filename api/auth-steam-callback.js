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
  try {
    console.log('Environment Variables:', {
      STEAM_API_KEY: process.env.STEAM_API_KEY ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
    });

    const { query } = req;
    if (!query || query['openid.mode'] !== 'id_res' || !query['openid.claimed_id']) {
      console.error('Invalid OpenID response:', query);
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    const steamid = extractSteamId(query['openid.claimed_id']);
    if (!steamid) {
      console.error('Failed to extract Steam ID:', query['openid.claimed_id']);
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    const valid = await verifyWithSteam(query);
    if (!valid) {
      console.error('Steam verification failed:', query);
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    const profile = await fetchSteamProfile(steamid);
    if (!profile) {
      console.error('Failed to fetch Steam profile for ID:', steamid);
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    console.log('Steam profile fetched successfully:', profile);

    const steamUser = {
      _json: {
        avatarmedium: profile.avatarmedium,
        personaname: profile.personaname,
      },
      displayName: profile.personaname,
      steamid: profile.steamid,
    };

    const token = jwt.sign(steamUser, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('JWT token generated successfully.');

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
