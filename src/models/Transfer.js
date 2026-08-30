import mongoose from 'mongoose';

const TransferSchema = new mongoose.Schema({
  id: String,
  name: String,
  type: String,
  vehicle: String,
  price: Number,
  image: String,
  description: String
}, { timestamps: true, strict: false });

export const Transfer = mongoose.models.Transfer || mongoose.model('Transfer', TransferSchema);
export default Transfer;
