require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const reconciliationRoutes = require('./routes/reconciliationRoutes');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api', reconciliationRoutes);

const PORT = process.env.PORT || 3000;

// Connect to DB and Start Server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
