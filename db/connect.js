import { MongoClient } from 'mongodb';

let db = null;

export async function connectToDB() {
  if (db) return db;

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('cv-builder');
  console.log('Connected to MongoDB');
  return db;
}

export function getDB() {
  if (!db) {
    throw new Error('Database not connected. Call connectToDB first.');
  }
  return db;
}

export { ObjectId } from 'mongodb';
