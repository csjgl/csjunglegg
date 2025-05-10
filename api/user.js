import jwt from 'jsonwebtoken';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const { cookie } = req.headers;
  if (!cookie) {
    console.error('No cookies found in request headers');
    return res.status(401).json({ error: 'No cookies found' });
  }

  const token = cookie.split(';').find(c => c.trim().startsWith('token='));
  if (!token) {
    console.error('Token not found in cookies');
    return res.status(401).json({ error: 'Token not found' });
  }

  try {
    const userFromToken = jwt.verify(token.split('=')[1], process.env.JWT_SECRET);
    if (!userFromToken || typeof userFromToken.steamid !== 'string' || !userFromToken.steamid) {
      console.error('Invalid token or missing steamid:', userFromToken);
      return res.status(401).json({ error: 'Invalid token or missing steamid' });
    }

    const steamId = userFromToken.steamid;
    const name = userFromToken.displayName || userFromToken.personaname || 'Unknown';
    const avatar = (userFromToken._json && userFromToken._json.avatarmedium) || userFromToken.avatar || '';

    let dbUser;
    try {
      dbUser = await prisma.user.findUnique({ where: { steamId } });
      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            steamId,
            name,
            avatar,
            balance: 0,
          },
        });
      }
    } catch (prismaError) {
      console.error('Prisma error in /api/user:', prismaError);
      return res.status(500).json({ error: 'Database error', details: prismaError.message });
    }

    res.json({
      ...userFromToken,
      balance: dbUser.balance,
    });
  } catch (e) {
    console.error('Error verifying token:', e);
    return res.status(500).json({ error: 'Internal server error', details: e.message });
  }
}
