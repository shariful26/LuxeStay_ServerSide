import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  id: String,
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'manager', 'admin'], default: 'customer' },
  phone: String,
  avatar: String,
  country: String,
  memberSince: String,
  address: String,
  city: String,
  state: String,
  zip: String
}, { timestamps: true, strict: false });

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ id: 1 }, { sparse: true });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;
