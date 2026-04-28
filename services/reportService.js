const ReconciliationReport = require('../models/ReconciliationReport');

/**
 * Gets the full report for a runId
 */
const getReport = async (runId) => {
  return await ReconciliationReport.find({ runId }).lean();
};

/**
 * Gets the summary counts for a runId
 */
const getSummary = async (runId) => {
  const result = await ReconciliationReport.aggregate([
    { $match: { runId } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);
  
  const summary = {
    Matched: 0,
    Conflicting: 0,
    'Unmatched (User only)': 0,
    'Unmatched (Exchange only)': 0,
  };

  result.forEach(r => {
    if (summary[r._id] !== undefined) {
      summary[r._id] = r.count;
    }
  });

  return summary;
};

/**
 * Gets only unmatched entries for a runId
 */
const getUnmatched = async (runId) => {
  return await ReconciliationReport.find({ 
    runId, 
    category: { $in: ['Unmatched (User only)', 'Unmatched (Exchange only)'] } 
  }).lean();
};

module.exports = {
  getReport,
  getSummary,
  getUnmatched
};
