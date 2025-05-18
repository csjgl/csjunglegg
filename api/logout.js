export default async function handler(req, res) {
  try {
    // Always include Secure in production (Vercel/HTTPS)
    const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
    res.setHeader('Set-Cookie', [
      `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax;${secure}`,
      `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=csjunglegg.vercel.app;${secure}`,
      `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=.csjunglegg.vercel.app;${secure}`,
      `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=localhost;`,
      `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Domain=127.0.0.1;`
    ]);
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
