import mongoose from 'mongoose';

const ConciergeRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  guestName: { type: String, required: true },
  roomNumber: { type: String, default: 'Suite 101' },
  requestType: { type: String, default: 'VIP Dining Reservation' },
  status: { type: String, default: 'Pending' },
  notes: { type: String },
  time: { type: String }
}, { timestamps: true, strict: false });

export const ConciergeRequest = mongoose.models.ConciergeRequest || mongoose.model('ConciergeRequest', ConciergeRequestSchema);
export default ConciergeRequest;
