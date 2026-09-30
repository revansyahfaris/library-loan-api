const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');

/** GET /api/members?search=... */
async function listMembers(req, res, next) {
  try {
    let query = supabase
      .from('members')
      .select('id, member_code, name, email, phone, created_at')
      .order('name', { ascending: true });

    if (req.query.search) {
      query = query.ilike('name', `%${req.query.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw new ApiError(500, 'Gagal mengambil data anggota', error.message);
    }

    return res.json({
      success: true,
      message: 'Daftar anggota berhasil diambil',
      total: data.length,
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/members */
async function createMember(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('members')
      .insert(req.validatedBody)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError(409, 'member_code atau email sudah terdaftar');
      }
      throw new ApiError(500, 'Gagal menambahkan anggota', error.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Anggota berhasil ditambahkan',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/books?search=...&available=true */
async function listBooks(req, res, next) {
  try {
    let query = supabase
      .from('books')
      .select('id, isbn, title, author, publisher, year, stock, created_at')
      .order('title', { ascending: true });

    if (req.query.search) {
      query = query.ilike('title', `%${req.query.search}%`);
    }
    if (req.query.available === 'true') {
      query = query.gt('stock', 0);
    }

    const { data, error } = await query;
    if (error) {
      throw new ApiError(500, 'Gagal mengambil data buku', error.message);
    }

    return res.json({
      success: true,
      message: 'Daftar buku berhasil diambil',
      total: data.length,
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/books */
async function createBook(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('books')
      .insert(req.validatedBody)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError(409, 'ISBN sudah terdaftar');
      }
      throw new ApiError(500, 'Gagal menambahkan buku', error.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Buku berhasil ditambahkan',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listMembers, createMember, listBooks, createBook };
