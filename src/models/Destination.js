import mongoose from 'mongoose';

const DestinationSchema = new mongoose.Schema({
  id: String,
  name: String,
  slug: String,
  country: String,
  tagline: String,
  image: String,
  hotelCount: Number,
  featured: Boolean,
  description: String
}, { timestamps: true, strict: false });

export const Destination = mongoose.models.Destination || mongoose.model('Destination', DestinationSchema);
export default Destination;
