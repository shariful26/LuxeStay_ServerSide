import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  hotelId: { type: String },
  itemName: { type: String },
  category: { type: String },
  quantity: { type: Number, default: 0 },
  unit: { type: String },
  minThreshold: { type: Number, default: 5 },
  status: { type: String, default: 'In Stock' },
  lastRestocked: { type: String }
}, { timestamps: true });

export const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
