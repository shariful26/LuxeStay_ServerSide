import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  hotelId: { type: String },
  hotelName: { type: String },
  guestName: { type: String },
  guestAvatar: { type: String },
  guestCountry: { type: String },
  rating: { type: Number, default: 5 },
  categories: { type: Object, default: {} },
  title: { type: String },
  comment: { type: String },
  date: { type: String },
  verifiedStay: { type: Boolean, default: true },
  helpfulCount: { type: Number, default: 0 },
  partnerReply: { type: Object, default: null }
}, { timestamps: true });

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
