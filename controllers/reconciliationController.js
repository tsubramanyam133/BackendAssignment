const crypto = require('crypto');
const ingestionService = require('../services/ingestionService');
const matchingService = require('../services/matchingService');
const reportService = require('../services/reportService');
const fs = require('fs');

/**
 * Trigger reconciliation run
 * Expects 2 CSV files via multipart/form-data: 'userFile', 'exchangeFile'
 */
const triggerReconciliation = async (req, res) => {
  try {
    if (!req.files || !req.files.userFile || !req.files.exchangeFile) {
      return res.status(400).json({ error: 'Please upload both userFile and exchangeFile.' });
    }

    const userFilePath = req.files.userFile[0].path;
    const exchangeFilePath = req.files.exchangeFile[0].path;
    
    // Config overrides
    const config = {
      timestampToleranceSeconds: req.body.timestampToleranceSeconds ? parseInt(req.body.timestampToleranceSeconds) : process.env.TIMESTAMP_TOLERANCE_SECONDS,
      quantityTolerancePct: req.body.quantityTolerancePct ? parseFloat(req.body.quantityTolerancePct) : process.env.QUANTITY_TOLERANCE_PCT
    };

    const runId = crypto.randomUUID();

    // Ingest data
    const userRows = await ingestionService.ingestCsv(userFilePath, 'USER', runId);
    const exchangeRows = await ingestionService.ingestCsv(exchangeFilePath, 'EXCHANGE', runId);

    // Run matching engine
    await matchingService.runReconciliation(runId, config);

    // Cleanup temp files
    fs.unlinkSync(userFilePath);
    fs.unlinkSync(exchangeFilePath);

    res.status(202).json({
      message: 'Reconciliation run completed successfully.',
      runId,
      userRowsProcessed: userRows,
      exchangeRowsProcessed: exchangeRows
    });

  } catch (error) {
    console.error('Reconciliation Error:', error);
    res.status(500).json({ error: 'Internal server error during reconciliation.' });
  }
};

/**
 * Fetch full report for a run
 */
const getFullReport = async (req, res) => {
  try {
    const report = await reportService.getReport(req.params.runId);
    if (!report || report.length === 0) {
      return res.status(404).json({ error: 'Report not found for given runId.' });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * Fetch summary for a run
 */
const getSummary = async (req, res) => {
  try {
    const summary = await reportService.getSummary(req.params.runId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * Fetch unmatched entries for a run
 */
const getUnmatched = async (req, res) => {
  try {
    const unmatched = await reportService.getUnmatched(req.params.runId);
    res.json(unmatched);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  triggerReconciliation,
  getFullReport,
  getSummary,
  getUnmatched
};
