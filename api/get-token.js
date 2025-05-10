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

  try {
    // Verify the token to ensure it's valid
    const decoded = jwt.verify(token, import.meta.env.JWT_SECRET);
    res.status(200).json({ token });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
