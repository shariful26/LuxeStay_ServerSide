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

HotelSchema.index({ id: 1 }, { unique: true, sparse: true });
HotelSchema.index({ slug: 1 });
HotelSchema.index({ destination: 1 });
HotelSchema.index({ destinationSlug: 1 });
HotelSchema.index({ category: 1 });
HotelSchema.index({ featured: 1, status: 1 });
HotelSchema.index({ partnerId: 1 });
HotelSchema.index({ status: 1 });

export const Hotel = mongoose.models.Hotel || mongoose.model('Hotel', HotelSchema);
export default Hotel;
