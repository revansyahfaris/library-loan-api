require('dotenv').config();

const express = require('express');
const cors = require('cors');

const loanRoutes = require('./routes/loanRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// Informasi umum API
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Library Loan API - Responsi PPB 2026',
    version: '1.0.0',
    documentation: 'https://github.com/<username>/library-loan-api#readme',
    endpoints: {
      loans: {
        list: 'GET /api/loans',
        detail: 'GET /api/loans/:id',
        create: 'POST /api/loans',
        update: 'PUT /api/loans/:id',
        return: 'PATCH /api/loans/:id/return',
        delete: 'DELETE /api/loans/:id',
      },
      catalog: {
        members: 'GET /api/members | POST /api/members',
        books: 'GET /api/books | POST /api/books',
      },
      health: 'GET /health',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/loans', loanRoutes);
app.use('/api', catalogRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
