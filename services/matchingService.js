const Transaction = require('../models/Transaction');
const ReconciliationReport = require('../models/ReconciliationReport');

// Basic alias mapping
const normalizeAsset = (asset) => {
  const mapping = {
    'BITCOIN': 'BTC',
    'ETHEREUM': 'ETH',
    'TETHER': 'USDT'
  };
  return mapping[asset] || asset;
};

// Map exchange type to user type for comparison
const mapType = (type) => {
  const mapping = {
    'TRANSFER_IN': 'TRANSFER_OUT',
    'TRANSFER_OUT': 'TRANSFER_IN',
    'DEPOSIT': 'WITHDRAWAL',
    'WITHDRAWAL': 'DEPOSIT',
    'BUY': 'BUY', // Sometimes buys/sells are same on both
    'SELL': 'SELL'
  };
  return mapping[type] || type;
};

/**
 * Runs the matching engine for a specific runId
 * @param {String} runId
 * @param {Object} config - { timestampToleranceSeconds, quantityTolerancePct }
 */
const runReconciliation = async (runId, config) => {
  const timestampToleranceMs = (config.timestampToleranceSeconds || 300) * 1000;
  const quantityTolerancePct = (config.quantityTolerancePct || 0.01) / 100; // if 0.01 passed as percent, divide by 100

  // Fetch all valid transactions for the run
  const userTxns = await Transaction.find({ runId, source: 'USER', isBadRow: false }).lean();
  const exchangeTxns = await Transaction.find({ runId, source: 'EXCHANGE', isBadRow: false }).lean();
  
  // Also fetch bad rows to include in report as Unmatched or Errors
  const badUserTxns = await Transaction.find({ runId, source: 'USER', isBadRow: true }).lean();
  const badExchangeTxns = await Transaction.find({ runId, source: 'EXCHANGE', isBadRow: true }).lean();

  const reportEntries = [];
  const matchedExchangeIds = new Set();

  for (const uTx of userTxns) {
    const uAsset = normalizeAsset(uTx.asset);
    
    // Find potential matches based on Asset and Type
    const potentialMatches = exchangeTxns.filter(eTx => {
      if (matchedExchangeIds.has(eTx._id.toString())) return false;
      const eAsset = normalizeAsset(eTx.asset);
      const mappedEType = mapType(eTx.type);
      
      return eAsset === uAsset && (eTx.type === uTx.type || mappedEType === uTx.type);
    });

    let bestMatch = null;
    let isConflicting = false;
    let conflictReason = '';

    for (const pMatch of potentialMatches) {
      // Check tolerances
      const timeDiffMs = Math.abs(uTx.timestamp.getTime() - pMatch.timestamp.getTime());
      
      const qtyDiff = Math.abs(uTx.quantity - pMatch.quantity);
      // Percentage diff based on user quantity
      const maxAllowedDiff = uTx.quantity * quantityTolerancePct;

      const timeOk = timeDiffMs <= timestampToleranceMs;
      const qtyOk = qtyDiff <= maxAllowedDiff;

      // Also check exact transactionId match if both have it
      const idMatch = (uTx.transactionId && pMatch.transactionId && uTx.transactionId === pMatch.transactionId);

      if (idMatch || (timeOk && qtyOk)) {
        if (!timeOk || !qtyOk) {
            // Matched by ID but tolerances failed
            isConflicting = true;
            bestMatch = pMatch;
            conflictReason = !timeOk ? 'Timestamp outside tolerance. ' : '';
            conflictReason += !qtyOk ? 'Quantity outside tolerance.' : '';
            break; // Stop looking for this user tx
        } else {
            // Perfect match
            bestMatch = pMatch;
            isConflicting = false;
            break; // Found perfect match
        }
      } else if (timeOk || qtyOk) {
          // Close match, maybe conflicting
          isConflicting = true;
          bestMatch = pMatch;
          conflictReason = !timeOk ? 'Timestamp outside tolerance. ' : '';
          conflictReason += !qtyOk ? 'Quantity outside tolerance.' : '';
      }
    }

    if (bestMatch) {
      matchedExchangeIds.add(bestMatch._id.toString());
      
      reportEntries.push({
        runId,
        category: isConflicting ? 'Conflicting' : 'Matched',
        reason: isConflicting ? conflictReason.trim() : 'Matched within tolerances.',
        userTransactionId: uTx._id,
        exchangeTransactionId: bestMatch._id,
        userRawData: uTx.rawData,
        exchangeRawData: bestMatch.rawData
      });
    } else {
      // Unmatched (User only)
      reportEntries.push({
        runId,
        category: 'Unmatched (User only)',
        reason: 'No matching exchange transaction found.',
        userTransactionId: uTx._id,
        userRawData: uTx.rawData
      });
    }
  }

  // Handle unmatched exchange transactions
  for (const eTx of exchangeTxns) {
    if (!matchedExchangeIds.has(eTx._id.toString())) {
      reportEntries.push({
        runId,
        category: 'Unmatched (Exchange only)',
        reason: 'No matching user transaction found.',
        exchangeTransactionId: eTx._id,
        exchangeRawData: eTx.rawData
      });
    }
  }

  // Add bad rows to report (optional, but good for completeness)
  for (const bTx of badUserTxns) {
      reportEntries.push({
        runId,
        category: 'Unmatched (User only)',
        reason: `Bad Row: ${bTx.rejectReason}`,
        userTransactionId: bTx._id,
        userRawData: bTx.rawData
      });
  }
  for (const bTx of badExchangeTxns) {
      reportEntries.push({
        runId,
        category: 'Unmatched (Exchange only)',
        reason: `Bad Row: ${bTx.rejectReason}`,
        exchangeTransactionId: bTx._id,
        exchangeRawData: bTx.rawData
      });
  }

  // Save report
  await ReconciliationReport.insertMany(reportEntries);
};

module.exports = {
  runReconciliation
};
