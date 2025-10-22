import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db/connect.js';

const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

// Save CV data
router.post('/api/cv', isAuthenticated, async (req, res) => {
  try {
    const db = getDB();
    const { cvData } = req.body;
    const userId = req.user._id;

    // Check if user already has a CV
    const existingCV = await db.collection('cvs').findOne({ userId: new ObjectId(userId) });

    if (existingCV) {
      // Update existing CV
      await db.collection('cvs').updateOne(
        { _id: existingCV._id },
        { $set: { cvData, updatedAt: new Date() } }
      );
      return res.status(200).json({ message: 'CV updated successfully' });
    } else {
      // Create new CV
      await db.collection('cvs').insertOne({
        userId: new ObjectId(userId),
        cvData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return res.status(201).json({ message: 'CV saved successfully' });
    }
  } catch (error) {
    console.error('Error saving CV:', error);
    res.status(500).json({ error: 'Failed to save CV' });
  }
});

// Get user's CV data
router.get('/api/cv', isAuthenticated, async (req, res) => {
  try {
    const db = getDB();
    const userId = req.user._id;
    
    const cv = await db.collection('cvs').findOne({ userId: new ObjectId(userId) });
    
    if (!cv) {
      return res.status(404).json({ error: 'No CV found' });
    }
    
    res.status(200).json(cv);
  } catch (error) {
    console.error('Error fetching CV:', error);
    res.status(500).json({ error: 'Failed to fetch CV' });
  }
});

export default router;
