const mongoose = require('mongoose');

const FacilitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    iconName: {
        type: String, // name of icon to use on frontend
        default: 'Star'
    }
});

module.exports = mongoose.model('Facility', FacilitySchema);
