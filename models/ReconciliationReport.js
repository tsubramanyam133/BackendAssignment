const mongoose = require('mongoose');

const reconciliationReportSchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['Matched', 'Conflicting', 'Unmatched (User only)', 'Unmatched (Exchange only)'],
    required: true,
  },
  reason: {
    type: String,
  },
  userTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  },
  exchangeTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  },
  userRawData: {
    type: Object,
  },
  exchangeRawData: {
    type: Object,
  },
}, { timestamps: true });

module.exports = mongoose.model('ReconciliationReport', reconciliationReportSchema);
