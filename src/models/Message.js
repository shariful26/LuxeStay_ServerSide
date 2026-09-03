import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  senderId: { type: String },
  senderName: { type: String },
  senderRole: { type: String },
  senderAvatar: { type: String },
  recipientId: { type: String },
  recipientName: { type: String },
  recipientRole: { type: String },
  text: { type: String },
  time: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

messageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, read: 1 });
messageSchema.index({ createdAt: -1 });

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

