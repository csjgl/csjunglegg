import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

export default async function handler(req, res) {
  // Debugging: Log incoming request headers
  console.log('Request Headers:', req.headers);

  // Parse cookies manually if req.cookies is undefined
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  console.log('Parsed Cookies:', cookies); // Debugging: Log parsed cookies

  const token = cookies.token;

  if (!token) {
    res.status(401).json({ error: 'Token not found', details: 'No token cookie was sent in the request.' });
    return;
  }

  // Ensure the secret is correctly loaded from the environment variables
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: 'JWT_SECRET is not defined in the environment variables' });
    return;
  }

  try {
    // Verify the token using the correct secret
    const decoded = jwt.verify(token, secret);
    console.log('Decoded Token:', decoded); // Debugging: Log decoded token
    res.status(200).json({ token });
  } catch (error) {
    console.error('Token Verification Error:', error.message); // Debugging: Log verification error
    res.status(401).json({ error: 'Invalid token', details: error.message });
  }
}
