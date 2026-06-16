const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ip: { type: String, required: true },
  sn: { type: String, default: '' },
  channelNumber: { type: Number },
  recorderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recorder', required: true },
  url: { type: String, default: "" }
}, { collection: 'cameras', versionKey: false, timestamps: true });

cameraSchema.virtual('id').get(function() { return this._id.toHexString(); });
cameraSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Camera', cameraSchema);