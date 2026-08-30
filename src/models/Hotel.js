import mongoose from 'mongoose';

const HotelSchema = new mongoose.Schema({
  id: String,
  name: String,
  slug: String,
  tagline: String,
  destination: String,
  destinationSlug: String,
  address: String,
  pricePerNight: Number,
  rating: Number,
  reviewCount: Number,
  starRating: Number,
  featured: Boolean,
  category: String,
  images: [String],
  amenities: [String],
  description: String,
  partnerId: String,
  partnerName: String,
  status: String
}, { timestamps: true, strict: false });

export const Hotel = mongoose.models.Hotel || mongoose.model('Hotel', HotelSchema);
export default Hotel;
