import express from "express";
import session from "express-session";
import passport from "passport";
import dotenv from "dotenv";
import cors from "cors";
import { connectToDB } from "./db/connect.js";
import "./routes/auth.js"; // Import passport setup (no exports needed)
import cvRoutes from "./routes/cv.js";

dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectToDB().catch(console.error);

// Middleware
const allowedOrigins = [
  'http://localhost:5173', // Local development
  'https://cv-builder-client.vercel.app', // Replace with your Vercel URL
  'https://cv-builder-api.onrender.com' // Replace with your Render URL
];

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
  })
);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// -----------------------------
// 🔐 Google OAuth Routes
// -----------------------------
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Use environment variable for frontend URL with fallback to localhost
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: `${FRONTEND_URL}/`,
    failureRedirect: `${FRONTEND_URL}/login`,
  })
);

// Handle both GET and POST requests for logout
const handleLogout = (req, res) => {
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
      
      // Clear the session cookie
      res.clearCookie('connect.sid');
      
      // For API requests, send a JSON response
      if (req.get('Content-Type') === 'application/json') {
        return res.json({ success: true });
      }
      
      // For browser requests, redirect
      res.redirect('http://localhost:5173/');
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
