import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  id: String,
  hotelId: String,
  hotelName: String,
  roomId: String,
  roomName: String,
  guestName: String,
  guestEmail: String,
  guestPhone: String,
  checkIn: String,
  checkOut: String,
  nights: Number,
  guests: Number,
  nightlyRate: Number,
  subtotal: Number,
  addOns: Array,
  discount: Number,
  tax: Number,
  total: Number,
  currency: String,
  paymentMethod: String,
  status: String,
  userId: String
}, { timestamps: true, strict: false });

export const Booking = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);
export default Booking;
