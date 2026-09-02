import mongoose from 'mongoose';

const ConciergeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  position: { type: String, default: 'Head Concierge' },
  schedule: { type: String, default: 'Monday - Friday | 8 AM - 4 PM' },
  contact: { type: String, default: '+1 (555) 123-4567' },
  email: { type: String },
  status: { type: String, default: 'Active' },
  hotelId: { type: String, default: 'h1' }
}, { timestamps: true, strict: false });

export const Concierge = mongoose.models.Concierge || mongoose.model('Concierge', ConciergeSchema);
export default Concierge;
