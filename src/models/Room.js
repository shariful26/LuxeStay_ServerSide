import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  id: String,
  hotelId: String,
  name: String,
  slug: String,
  type: String,
  price: Number,
  size: String,
  capacity: Number,
  bedType: String,
  view: String,
  images: [String],
  amenities: [String],
  inclusions: Object,
  description: String,
  available: Boolean,
  status: String
}, { timestamps: true, strict: false });

RoomSchema.index({ id: 1 }, { unique: true, sparse: true });
RoomSchema.index({ hotelId: 1, status: 1 });
RoomSchema.index({ slug: 1 });

export const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);
export default Room;
