import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import passport from "passport";
import dotenv from "dotenv";
import cors from "cors";
import { connectToDB } from "./db/connect.js";
import "./config/passport.js"; // Import passport configuration
import cvRoutes from "./routes/cv.js";

dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectToDB().catch(console.error);

// Trust first proxy (important for HTTPS behind proxy)
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = [
  'http://localhost:5173', // Local development
  'https://cvforge.vercel.app', // Your Vercel frontend
  'https://cvforge-back.onrender.com' // Your Render backend
];

// Force HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && 
      req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions'
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      httpOnly: true
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

// -----------------------------
// 🔐 Google OAuth Routes
// -----------------------------
app.get(
  "/auth/google",
  (req, res, next) => {
    // Store the returnTo URL in the session
    if (req.query.returnTo) {
      req.session.returnTo = req.query.returnTo;
    }
    next();
  },
  passport.authenticate("google", { 
    scope: ["profile", "email"],
    prompt: 'select_account' // Forces account selection
  })
);

// Use environment variable for frontend URL with fallback to localhost
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { 
    failureRedirect: `${FRONTEND_URL}/login?error=auth_failed`,
    failureFlash: true
  }),
  (req, res) => {
    // Successful authentication, redirect to the stored URL or home
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(`${FRONTEND_URL}${returnTo}`);
  }
);

// Handle both GET and POST requests for logout
const handleLogout = (req, res) => {
  // Store the redirect URL before logging out
  const returnTo = req.query.returnTo || '/';
  
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).json({ message: 'Error logging out' });
    }
    
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ message: 'Error destroying session' });
      }
      
      // Clear the session cookie with the same options as the session
      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      });
      
      // For API requests, send a JSON response
      if (req.get('Content-Type') === 'application/json') {
        return res.json({ success: true });
      }
      
      // For browser requests, redirect to the frontend with the returnTo parameter
      res.redirect(`${FRONTEND_URL}${returnTo}`);
    });
  });
};

app.get("/auth/logout", handleLogout);
app.post("/auth/logout", handleLogout);

// -----------------------------
// 🚀 CV routes
app.use(cvRoutes);

// User info endpoint
app.get("/auth/user", (req, res) => {
  if (req.user) {
    // Only send necessary user data, not the entire user object
    const { _id, displayName, emails } = req.user;
    return res.json({ _id, displayName, email: emails?.[0]?.value || null });
  }
  res.json(null);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// -----------------------------
// 🚀 Server Startup
// -----------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB URI: ${process.env.MONGODB_URI ? 'Configured' : 'Not configured'}`);
});
