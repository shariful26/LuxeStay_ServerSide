import mongoose from 'mongoose';

const PayoutSchema = new mongoose.Schema({
  id: String,
  partnerId: String,
  partnerName: String,
  amount: Number,
  method: String,
  accountName: String,
  accountDetails: String,
  bankName: String,
  status: String,
  createdAt: String
}, { timestamps: true, strict: false });

export const Payout = mongoose.models.Payout || mongoose.model('Payout', PayoutSchema);
export default Payout;
