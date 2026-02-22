const mongoose = require('mongoose');

const FoodMenuSchema = new mongoose.Schema({
    day: {
        type: String, // e.g., 'Monday', 'Tuesday'
        required: true,
        unique: true
    },
    breakfast: { type: String, required: true },
    breakfastImg: { type: String, default: '' },
    lunch: { type: String, required: true },
    lunchImg: { type: String, default: '' },
    dinner: { type: String, required: true },
    dinnerImg: { type: String, default: '' },
});

module.exports = mongoose.model('FoodMenu', FoodMenuSchema);
