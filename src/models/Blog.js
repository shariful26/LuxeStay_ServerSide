import mongoose from 'mongoose';

const BlogSchema = new mongoose.Schema({
  id: String,
  title: String,
  slug: String,
  author: String,
  date: String,
  category: String,
  image: String,
  excerpt: String,
  content: String
}, { timestamps: true, strict: false });

export const Blog = mongoose.models.Blog || mongoose.model('Blog', BlogSchema);
export default Blog;
