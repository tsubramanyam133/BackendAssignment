const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ['USER', 'EXCHANGE'],
    required: true,
  },
  runId: {
    type: String,
    required: true,
  },
  transactionId: {
    type: String,
  },
  timestamp: {
    type: Date,
  },
  quantity: {
    type: Number,
  },
  type: {
    type: String,
  },
  asset: {
    type: String,
  },
  rawData: {
    type: Object,
  },
  isBadRow: {
    type: Boolean,
    default: false,
  },
  rejectReason: {
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
