const mongoose = require('mongoose');

const BedSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true
  },
  bedNumber: {
    type: String,
    required: true
  },
  isOccupied: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: ['Classic', 'Premium'],
    default: 'Classic'
  }
});

module.exports = mongoose.model('Bed', BedSchema);
