const mongoose = require("mongoose");

const PersonSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  mobile: {
    type: String,
    required: false,
    trim: true,
    default: "",
  },
});

module.exports = mongoose.model("Person", PersonSchema);
