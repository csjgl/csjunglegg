import jwt from 'jsonwebtoken';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const { cookie } = req.headers;
  if (!cookie) return res.json(null);

  const token = cookie.split(';').find(c => c.trim().startsWith('token='));
  if (!token) return res.json(null);

  try {
    const userFromToken = jwt.verify(token.split('=')[1], process.env.JWT_SECRET);
    
    // Debugging: Log the entire decoded token
    console.log('Decoded JWT:', userFromToken);

    // Use `sub` as the primary identifier
    const steamId = userFromToken.sub;
    if (!steamId || typeof steamId !== 'string') {
      res.status(401).json({ error: 'Invalid token or missing sub claim', details: userFromToken });
      return;
    }

    // Defensive: fallback for displayName and avatar
    const name = userFromToken.displayName || userFromToken.personaname || 'Unknown';
    const avatar = (userFromToken._json && userFromToken._json.avatarmedium) || userFromToken.avatar || '';

    // Find or create user in DB
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
      res.status(500).json({ error: 'Prisma error', details: prismaError.message, meta: prismaError.meta });
      return;
    }

    // Return both Steam info and balance
    res.json({
      ...userFromToken,
      balance: dbUser.balance,
    });
  } catch (e) {
    console.error('Error in /api/user:', e); // Log error for debugging
    if (e instanceof Error) {
      res.status(500).json({ error: 'Internal server error', details: e.message, stack: e.stack });
    } else {
      res.status(500).json({ error: 'Internal server error', details: e });
    }
  }
}
