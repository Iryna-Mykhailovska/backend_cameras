const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String }
}, { collection: 'company', versionKey: false, timestamps: true });

companySchema.virtual('id').get(function() { return this._id.toHexString(); });
companySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Company', companySchema);