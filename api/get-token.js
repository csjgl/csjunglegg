import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

export default async function handler(req, res) {
  // Parse cookies manually if req.cookies is undefined
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const token = cookies.token;

  if (!token) {
    res.status(401).json({ error: 'Token not found' });
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
    res.status(200).json({ token });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token', details: error.message });
  }
}
