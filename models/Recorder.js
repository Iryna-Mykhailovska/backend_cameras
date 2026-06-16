const mongoose = require('mongoose');

const recorderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ip: { type: String, required: true },
  channels: { type: Number, default: 16 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { collection: 'recorders', versionKey: false, timestamps: true });

recorderSchema.virtual('id').get(function() { return this._id.toHexString(); });
recorderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Recorder', recorderSchema);