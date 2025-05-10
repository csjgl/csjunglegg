import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // Check if the token is available in the cookies
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: 'Token not found' });
    return;
  }

  try {
    // Verify the token to ensure it's valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ token });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
