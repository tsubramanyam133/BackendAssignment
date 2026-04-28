const fs = require('fs');
const csv = require('csv-parser');
const Transaction = require('../models/Transaction');

/**
 * Parses a CSV file and stores the transactions in the database.
 * @param {String} filePath Path to the CSV file
 * @param {String} source 'USER' or 'EXCHANGE'
 * @param {String} runId The reconciliation run ID
 */
const ingestCsv = async (filePath, source, runId) => {
  const results = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        let isBadRow = false;
        let rejectReason = '';
        
        // Basic normalization, find keys case insensitively if needed,
        // but let's assume some common column names.
        // Convert keys to lowercase for easier matching if the schema is messy.
        const normalizedData = {};
        for (const [key, value] of Object.entries(data)) {
          normalizedData[key.trim().toLowerCase()] = value ? value.trim() : '';
        }

        // Try to extract standard fields.
        // We will guess common column names.
        const type = normalizedData['type'] || normalizedData['transaction_type'] || normalizedData['side'] || '';
        const asset = normalizedData['asset'] || normalizedData['coin'] || normalizedData['currency'] || '';
        const timestampStr = normalizedData['timestamp'] || normalizedData['date'] || normalizedData['time'] || '';
        const quantityStr = normalizedData['quantity'] || normalizedData['amount'] || normalizedData['qty'] || '';
        const transactionId = normalizedData['transactionid'] || normalizedData['id'] || normalizedData['txid'] || '';

        let timestamp = null;
        let quantity = null;

        if (!type || !asset || !timestampStr || !quantityStr) {
          isBadRow = true;
          rejectReason = 'Missing required fields (type, asset, timestamp, or quantity).';
        } else {
          timestamp = new Date(timestampStr);
          if (isNaN(timestamp.getTime())) {
            isBadRow = true;
            rejectReason = 'Invalid timestamp format.';
            timestamp = null;
          }
          
          quantity = parseFloat(quantityStr);
          if (isNaN(quantity)) {
            isBadRow = true;
            rejectReason = 'Invalid quantity format.';
            quantity = null;
          }
        }

        results.push({
          source,
          runId,
          transactionId,
          timestamp,
          quantity,
          type: type.toUpperCase(),
          asset: asset.toUpperCase(),
          rawData: data,
          isBadRow,
          rejectReason,
        });
      })
      .on('end', async () => {
        try {
          // Insert all parsed rows into MongoDB
          if (results.length > 0) {
             await Transaction.insertMany(results);
          }
          resolve(results.length);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

module.exports = {
  ingestCsv,
};
