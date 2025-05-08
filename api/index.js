import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as SteamStrategy } from 'passport-steam';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Enable CORS with credentials
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', 'https://csjunglegg.vercel.app');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Configure SteamStrategy
passport.use(
  new SteamStrategy(
    {
      returnURL: process.env.RETURN_URL || 'https://csjunglegg.vercel.app/auth/steam/return',
      realm: process.env.REALM || 'https://csjunglegg.vercel.app/',
      apiKey: 'BBB3BF25ABAE77221F88DB1121118D56',
    },
    (identifier, profile, done) => {
      console.log('SteamStrategy parameters:', {
        returnURL: process.env.RETURN_URL || 'https://csjunglegg.vercel.app/auth/steam/return',
        realm: process.env.REALM || 'https://csjunglegg.vercel.app/',
        apiKey: 'BBB3BF25ABAE77221F88DB1121118D56',
      });
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Middleware
app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get('/auth/steam', (req, res, next) => {
  try {
    passport.authenticate('steam')(req, res, next);
  } catch (error) {
    console.error('Error in /auth/steam:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/auth/steam/return', (req, res, next) => {
  try {
    console.log('Request received at /auth/steam/return');
    console.log('Request query parameters:', req.query);
    passport.authenticate('steam', { failureRedirect: '/' }, (err, user) => {
      if (err) {
        console.error('Authentication error:', err);
        return res.status(500).send('Internal Server Error');
      }
      if (!user) {
        console.log('Authentication failed, redirecting to /');
        return res.redirect('/');
      }
      console.log('Authentication successful, user:', user);
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('Login error:', loginErr);
          return res.status(500).send('Internal Server Error');
        }
        console.log('User logged in successfully, redirecting to /user');
        return res.redirect('/');
      });
    })(req, res, next);
  } catch (error) {
    console.error('Error in /auth/steam/return:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/user', (req, res) => {
  res.json(req.user || null);
});

app.get('/api/user', (req, res) => {
  res.json(req.user || null);
});

export default (req, res) => {
  app(req, res);
};