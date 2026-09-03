import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  hotelId: { type: String },
  name: { type: String },
  itemName: { type: String },
  category: { type: String },
  stock: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'Units' },
  reorderLimit: { type: Number, default: 50 },
  minThreshold: { type: Number, default: 50 },
  availability: { type: String, default: 'Available' },
  status: { type: String, default: 'In Stock' },
  lastRestocked: { type: String }
}, { timestamps: true, strict: false });

export const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
export default Inventory;
