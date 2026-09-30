const ApiError = require('../utils/ApiError');

function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Error validasi dari Zod
  if (err.name === 'ZodError') {
    return res.status(422).json({
      success: false,
      message: 'Validasi gagal',
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { detail: err.details } : {}),
    });
  }

  // JSON body tidak valid
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Body request bukan JSON yang valid',
    });
  }

  console.error('[UNHANDLED ERROR]', err);
  return res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server',
    ...(process.env.NODE_ENV !== 'production' ? { detail: err.message } : {}),
  });
}

module.exports = { notFound, errorHandler };
