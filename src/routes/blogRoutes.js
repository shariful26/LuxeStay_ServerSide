import express from 'express';
import mongoose from 'mongoose';
import { Blog } from '../models/index.js';
import { readData, writeData } from '../utils/fileDb.js';
import { connectDatabase } from '../config/db.js';

const router = express.Router();

// GET all travel articles
router.get('/', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  await connectDatabase();
  let blogs = [];
  try {
    if (mongoose.connection.readyState === 1) {
      blogs = await Blog.find({}).sort({ createdAt: -1 }).lean();
    }
  } catch (e) {}

  if (!blogs || blogs.length === 0) {
    blogs = readData('blogs.json') || [];
  }

  res.json(blogs);
});

// GET blog post by slug / ID
router.get('/:slug', async (req, res) => {
  await connectDatabase();
  let blog = null;
  try {
    if (mongoose.connection.readyState === 1) {
      blog = await Blog.findOne({
        $or: [{ slug: req.params.slug }, { id: req.params.slug }, { _id: mongoose.isValidObjectId(req.params.slug) ? req.params.slug : null }]
      }).lean();
    }
  } catch (e) {}

  if (!blog) {
    const blogs = readData('blogs.json') || [];
    blog = blogs.find(b => b.slug === req.params.slug || b.id === req.params.slug);
  }

  if (!blog) return res.status(404).json({ error: 'Article not found' });
  res.json(blog);
});

// POST create blog article
router.post('/', async (req, res) => {
  await connectDatabase();
  const newBlog = {
    id: `blog_${Date.now()}`,
    title: req.body.title || 'New Travel Story',
    slug: (req.body.title || 'new-travel-story').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    author: req.body.author || 'LuxeStay Editorial',
    authorAvatar: (req.body.authorAvatar && typeof req.body.authorAvatar === 'string' && !req.body.authorAvatar.includes('photo-1534528741775'))
      ? req.body.authorAvatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(req.body.author || 'LuxeStay')}&background=0284c7&color=fff&bold=true`,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    category: req.body.category || 'Luxury Travel',
    image: req.body.image || 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
    summary: req.body.summary || 'Discover the most exclusive luxury experiences and curated destinations around the world.',
    content: req.body.content || 'Full travel guide and curated recommendations for the discerning traveler.'
  };

  try {
    if (mongoose.connection.readyState === 1) {
      const doc = new Blog(newBlog);
      await doc.save();
    }
  } catch (e) {}

  const blogs = readData('blogs.json') || [];
  blogs.unshift(newBlog);
  writeData('blogs.json', blogs);

  res.status(201).json(newBlog);
});

// PUT update blog article
router.put('/:id', async (req, res) => {
  await connectDatabase();
  let updatedDoc = null;
  try {
    if (mongoose.connection.readyState === 1) {
      updatedDoc = await Blog.findOneAndUpdate(
        { $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { slug: req.params.id }] },
        { $set: req.body },
        { new: true }
      ).lean();
    }
  } catch (e) {}

  const blogs = readData('blogs.json') || [];
  const index = blogs.findIndex(b => b.id === req.params.id || b.slug === req.params.id);
  if (index !== -1) {
    blogs[index] = { ...blogs[index], ...req.body };
    writeData('blogs.json', blogs);
    return res.json(updatedDoc || blogs[index]);
  }

  if (updatedDoc) return res.json(updatedDoc);
  res.json({ id: req.params.id, ...req.body });
});

// DELETE blog article
router.delete('/:id', async (req, res) => {
  await connectDatabase();
  try {
    if (mongoose.connection.readyState === 1) {
      await Blog.deleteOne({
        $or: [{ id: req.params.id }, { _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { slug: req.params.id }]
      });
    }
  } catch (e) {}

  let blogs = readData('blogs.json') || [];
  blogs = blogs.filter(b => b.id !== req.params.id && b.slug !== req.params.id);
  writeData('blogs.json', blogs);

  res.json({ success: true, message: 'Article deleted successfully' });
});

export default router;
