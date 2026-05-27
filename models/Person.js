const mongoose = require("mongoose");

const PersonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
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
