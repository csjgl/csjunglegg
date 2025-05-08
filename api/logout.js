export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  res.writeHead(302, { Location: '/' });
  res.end();
}
