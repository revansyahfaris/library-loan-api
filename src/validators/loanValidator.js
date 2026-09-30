const { z } = require('zod');

const LOAN_STATUS = ['Dipinjam', 'Dikembalikan', 'Terlambat'];
const SORTABLE_FIELDS = [
  'loan_date',
  'due_date',
  'return_date',
  'status',
  'fine',
  'created_at',
];

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

const uuid = (field) => z.string().uuid(`${field} harus berupa UUID yang valid`);

/** Query string untuk GET /api/loans */
const loanQuerySchema = z.object({
  status: z
    .enum(LOAN_STATUS, {
      errorMap: () => ({
        message: `status harus salah satu dari: ${LOAN_STATUS.join(', ')}`,
      }),
    })
    .optional(),
  member_id: uuid('member_id').optional(),
  book_id: uuid('book_id').optional(),
  member_name: z.string().min(1).max(100).optional(),
  book_title: z.string().min(1).max(200).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  due_before: dateString.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sort_by: z.enum(SORTABLE_FIELDS).default('loan_date'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/** Body untuk POST /api/loans */
const createLoanSchema = z.object({
  member_id: uuid('member_id'),
  book_id: uuid('book_id'),
  loan_date: dateString.optional(),
  due_date: dateString.optional(),
  notes: z.string().max(255).optional(),
});

/** Body untuk PUT /api/loans/:id */
const updateLoanSchema = z
  .object({
    loan_date: dateString.optional(),
    due_date: dateString.optional(),
    return_date: dateString.nullable().optional(),
    status: z.enum(LOAN_STATUS).optional(),
    fine: z.coerce.number().int().min(0).optional(),
    notes: z.string().max(255).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal satu field harus dikirim untuk diperbarui',
  });

/** Body untuk PATCH /api/loans/:id/return */
const returnLoanSchema = z.object({
  return_date: dateString.optional(),
  notes: z.string().max(255).optional(),
});

const createMemberSchema = z.object({
  member_code: z.string().min(3).max(30),
  name: z.string().min(3).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
});

const createBookSchema = z.object({
  isbn: z.string().max(20).optional(),
  title: z.string().min(1).max(200),
  author: z.string().max(100).optional(),
  publisher: z.string().max(100).optional(),
  year: z.coerce.number().int().min(1000).max(2100).optional(),
  stock: z.coerce.number().int().min(0).default(1),
});

module.exports = {
  LOAN_STATUS,
  SORTABLE_FIELDS,
  loanQuerySchema,
  createLoanSchema,
  updateLoanSchema,
  returnLoanSchema,
  createMemberSchema,
  createBookSchema,
};
