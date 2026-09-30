/**
 * Memvalidasi req.body menggunakan schema Zod.
 * Hasil parsing yang sudah bersih disimpan di req.validatedBody.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(result.error);
    }
    req.validatedBody = result.data;
    return next();
  };
}

module.exports = { validateBody };
