import express from 'express';
import { readData } from '../utils/fileDb.js';

const router = express.Router();

// GET all travel articles
router.get('/', (req, res) => {
  res.json(readData('blogs.json'));
});

// GET blog post by slug / ID
router.get('/:slug', (req, res) => {
  const blogs = readData('blogs.json');
  const blog = blogs.find(b => b.slug === req.params.slug || b.id === req.params.slug);
  if (!blog) return res.status(404).json({ error: 'Article not found' });
  res.json(blog);
});

export default router;
