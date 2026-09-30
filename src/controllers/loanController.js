const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { today, addDays, calculateFine } = require('../utils/dateHelper');
const { loanQuerySchema } = require('../validators/loanValidator');

const LOAN_PERIOD_DAYS = Number(process.env.LOAN_PERIOD_DAYS || 7);
const FINE_PER_DAY = Number(process.env.FINE_PER_DAY || 1000);

const BASE_FIELDS =
  'id, member_id, book_id, loan_date, due_date, return_date, status, fine, notes, created_at, updated_at';

/**
 * Membangun string select. `!inner` dipakai agar filter pada tabel relasi
 * ikut memfilter baris induk (loans).
 */
function buildSelect({ innerMember = false, innerBook = false } = {}) {
  return `${BASE_FIELDS},
    member:members${innerMember ? '!inner' : ''} (id, member_code, name, email),
    book:books${innerBook ? '!inner' : ''} (id, isbn, title, author, publisher)`;
}

/** Tandai peminjaman yang melewati jatuh tempo sebagai "Terlambat". */
async function syncOverdueStatus() {
  const { error } = await supabase
    .from('loans')
    .update({ status: 'Terlambat' })
    .eq('status', 'Dipinjam')
    .lt('due_date', today());

  if (error) {
    throw new ApiError(500, 'Gagal memperbarui status keterlambatan', error.message);
  }
}

/** Menyesuaikan stok buku (delta -1 saat dipinjam, +1 saat kembali). */
async function adjustStock(bookId, delta) {
  if (!delta) return;

  const { data, error } = await supabase
    .from('books')
    .select('stock')
    .eq('id', bookId)
    .maybeSingle();

  if (error || !data) return;

  const nextStock = Math.max(0, data.stock + delta);
  await supabase.from('books').update({ stock: nextStock }).eq('id', bookId);
}

async function findLoanOrFail(id) {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, 'Gagal mengambil data peminjaman', error.message);
  }
  if (!data) {
    throw new ApiError(404, `Peminjaman dengan id ${id} tidak ditemukan`);
  }
  return data;
}

async function fetchLoanWithRelations(id) {
  const { data, error } = await supabase
    .from('loans')
    .select(buildSelect())
    .eq('id', id)
    .single();

  if (error) {
    throw new ApiError(500, 'Gagal mengambil detail peminjaman', error.message);
  }
  return data;
}

/**
 * GET /api/loans
 * Mendukung filter: status, member_id, book_id, member_name, book_title,
 * from, to, due_before + pagination & sorting.
 */
async function listLoans(req, res, next) {
  try {
    const filters = loanQuerySchema.parse(req.query);
    await syncOverdueStatus();

    const select = buildSelect({
      innerMember: Boolean(filters.member_name),
      innerBook: Boolean(filters.book_title),
    });

    let query = supabase.from('loans').select(select, { count: 'exact' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.member_id) query = query.eq('member_id', filters.member_id);
    if (filters.book_id) query = query.eq('book_id', filters.book_id);
    if (filters.member_name) {
      query = query.ilike('member.name', `%${filters.member_name}%`);
    }
    if (filters.book_title) {
      query = query.ilike('book.title', `%${filters.book_title}%`);
    }
    if (filters.from) query = query.gte('loan_date', filters.from);
    if (filters.to) query = query.lte('loan_date', filters.to);
    if (filters.due_before) query = query.lte('due_date', filters.due_before);

    const offset = (filters.page - 1) * filters.limit;
    query = query
      .order(filters.sort_by, { ascending: filters.order === 'asc' })
      .range(offset, offset + filters.limit - 1);

    const { data, error, count } = await query;
    if (error) {
      throw new ApiError(500, 'Gagal mengambil daftar peminjaman', error.message);
    }

    const { page, limit, sort_by: sortBy, order, ...activeFilters } = filters;

    return res.json({
      success: true,
      message: 'Daftar peminjaman berhasil diambil',
      meta: {
        total: count ?? 0,
        page,
        limit,
        total_pages: Math.ceil((count ?? 0) / limit),
        sort_by: sortBy,
        order,
        filters: activeFilters,
      },
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/loans/:id */
async function getLoanById(req, res, next) {
  try {
    await syncOverdueStatus();
    await findLoanOrFail(req.params.id);
    const data = await fetchLoanWithRelations(req.params.id);

    return res.json({
      success: true,
      message: 'Detail peminjaman berhasil diambil',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/loans */
async function createLoan(req, res, next) {
  try {
    const payload = req.validatedBody;

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, name')
      .eq('id', payload.member_id)
      .maybeSingle();

    if (memberError) {
      throw new ApiError(500, 'Gagal memeriksa data anggota', memberError.message);
    }
    if (!member) {
      throw new ApiError(404, 'Anggota tidak ditemukan');
    }

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, stock')
      .eq('id', payload.book_id)
      .maybeSingle();

    if (bookError) {
      throw new ApiError(500, 'Gagal memeriksa data buku', bookError.message);
    }
    if (!book) {
      throw new ApiError(404, 'Buku tidak ditemukan');
    }
    if (book.stock <= 0) {
      throw new ApiError(409, `Stok buku "${book.title}" sedang habis`);
    }

    const loanDate = payload.loan_date || today();
    const dueDate = payload.due_date || addDays(loanDate, LOAN_PERIOD_DAYS);

    if (dueDate < loanDate) {
      throw new ApiError(422, 'due_date tidak boleh lebih awal dari loan_date');
    }

    const status = dueDate < today() ? 'Terlambat' : 'Dipinjam';

    const { data, error } = await supabase
      .from('loans')
      .insert({
        member_id: payload.member_id,
        book_id: payload.book_id,
        loan_date: loanDate,
        due_date: dueDate,
        notes: payload.notes ?? null,
        status,
        fine: 0,
      })
      .select(buildSelect())
      .single();

    if (error) {
      throw new ApiError(500, 'Gagal menyimpan data peminjaman', error.message);
    }

    await adjustStock(book.id, -1);

    return res.status(201).json({
      success: true,
      message: 'Peminjaman berhasil dicatat',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/** PUT /api/loans/:id */
async function updateLoan(req, res, next) {
  try {
    const existing = await findLoanOrFail(req.params.id);
    const body = req.validatedBody;

    const patch = {};
    if (body.loan_date !== undefined) patch.loan_date = body.loan_date;
    if (body.due_date !== undefined) patch.due_date = body.due_date;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.return_date !== undefined) patch.return_date = body.return_date;
    if (body.status !== undefined) patch.status = body.status;

    const finalLoanDate = patch.loan_date ?? existing.loan_date;
    const finalDueDate = patch.due_date ?? existing.due_date;
    const finalReturnDate =
      body.return_date !== undefined ? body.return_date : existing.return_date;

    if (finalDueDate < finalLoanDate) {
      throw new ApiError(422, 'due_date tidak boleh lebih awal dari loan_date');
    }

    if (finalReturnDate) {
      if (body.status === undefined) patch.status = 'Dikembalikan';
      patch.fine = calculateFine(finalDueDate, finalReturnDate, FINE_PER_DAY);
    } else {
      if (body.status === undefined) {
        patch.status = finalDueDate < today() ? 'Terlambat' : 'Dipinjam';
      }
      patch.fine = 0;
    }

    // Denda manual selalu menang jika dikirim secara eksplisit
    if (body.fine !== undefined) patch.fine = body.fine;

    const wasActive = existing.status !== 'Dikembalikan';
    const isActive = (patch.status ?? existing.status) !== 'Dikembalikan';

    const { data, error } = await supabase
      .from('loans')
      .update(patch)
      .eq('id', existing.id)
      .select(buildSelect())
      .single();

    if (error) {
      throw new ApiError(500, 'Gagal memperbarui data peminjaman', error.message);
    }

    if (wasActive && !isActive) await adjustStock(existing.book_id, 1);
    if (!wasActive && isActive) await adjustStock(existing.book_id, -1);

    return res.json({
      success: true,
      message: 'Data peminjaman berhasil diperbarui',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/loans/:id/return */
async function returnLoan(req, res, next) {
  try {
    const existing = await findLoanOrFail(req.params.id);

    if (existing.status === 'Dikembalikan') {
      throw new ApiError(409, 'Buku ini sudah dikembalikan sebelumnya');
    }

    const returnDate = req.validatedBody.return_date || today();
    if (returnDate < existing.loan_date) {
      throw new ApiError(422, 'return_date tidak boleh lebih awal dari loan_date');
    }

    const fine = calculateFine(existing.due_date, returnDate, FINE_PER_DAY);

    const patch = {
      return_date: returnDate,
      status: 'Dikembalikan',
      fine,
    };
    if (req.validatedBody.notes !== undefined) {
      patch.notes = req.validatedBody.notes;
    }

    const { data, error } = await supabase
      .from('loans')
      .update(patch)
      .eq('id', existing.id)
      .select(buildSelect())
      .single();

    if (error) {
      throw new ApiError(500, 'Gagal memproses pengembalian', error.message);
    }

    await adjustStock(existing.book_id, 1);

    return res.json({
      success: true,
      message:
        fine > 0
          ? `Pengembalian tercatat dengan denda Rp${fine.toLocaleString('id-ID')}`
          : 'Pengembalian berhasil dicatat tanpa denda',
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/loans/:id */
async function deleteLoan(req, res, next) {
  try {
    const existing = await findLoanOrFail(req.params.id);

    const { error } = await supabase.from('loans').delete().eq('id', existing.id);
    if (error) {
      throw new ApiError(500, 'Gagal menghapus data peminjaman', error.message);
    }

    // Buku yang masih berstatus dipinjam dikembalikan ke stok
    if (existing.status !== 'Dikembalikan') {
      await adjustStock(existing.book_id, 1);
    }

    return res.json({
      success: true,
      message: 'Data peminjaman berhasil dihapus',
      data: existing,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listLoans,
  getLoanById,
  createLoan,
  updateLoan,
  returnLoan,
  deleteLoan,
};
