import mongoose from 'mongoose';

const OfferSchema = new mongoose.Schema({
  id: String,
  code: String,
  title: String,
  discountPercentage: Number,
  validUntil: String,
  hotelId: String,
  hotelName: String,
  image: String,
  description: String
}, { timestamps: true, strict: false });

export const Offer = mongoose.models.Offer || mongoose.model('Offer', OfferSchema);
export default Offer;
