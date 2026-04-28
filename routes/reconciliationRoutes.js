const express = require('express');
const router = express.Router();
const multer = require('multer');
const reconciliationController = require('../controllers/reconciliationController');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

router.post(
  '/reconcile',
  upload.fields([
    { name: 'userFile', maxCount: 1 },
    { name: 'exchangeFile', maxCount: 1 }
  ]),
  reconciliationController.triggerReconciliation
);

router.get('/report/:runId', reconciliationController.getFullReport);
router.get('/report/:runId/summary', reconciliationController.getSummary);
router.get('/report/:runId/unmatched', reconciliationController.getUnmatched);

module.exports = router;
