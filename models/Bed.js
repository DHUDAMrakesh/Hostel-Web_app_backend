const mongoose = require('mongoose');

const BedSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true },
  bedNumber: { type: String, required: true },
  isOccupied: { type: Boolean, default: false },
  type: { type: String, enum: ['Classic', 'Premium'], default: 'Classic' },
  status: { type: String, enum: ['available', 'maintenance'], default: 'available' }
});

// Indexes for room management queries
BedSchema.index({ roomNumber: 1 });
BedSchema.index({ roomNumber: 1, isOccupied: 1 }); // most frequent filter

module.exports = mongoose.model('Bed', BedSchema);

