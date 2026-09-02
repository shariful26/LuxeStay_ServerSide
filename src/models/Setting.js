import mongoose from 'mongoose';

const SettingSchema = new mongoose.Schema({
  id: { type: String, default: 'payment_settings' },
  mode: { type: String, default: 'test' },
  gateways: { type: Object, default: {} },
  updatedAt: { type: String }
}, { timestamps: true, strict: false });

export const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
export default Setting;
