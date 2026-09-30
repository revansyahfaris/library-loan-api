const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Tanggal hari ini dalam format YYYY-MM-DD */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Tambah sejumlah hari pada tanggal YYYY-MM-DD */
function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Selisih hari (to - from). Bernilai positif jika `to` lebih akhir. */
function diffInDays(from, to) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / MS_PER_DAY);
}

/** Hitung denda keterlambatan berdasarkan jatuh tempo dan tanggal kembali */
function calculateFine(dueDate, returnDate, finePerDay) {
  const lateDays = diffInDays(dueDate, returnDate);
  return lateDays > 0 ? lateDays * finePerDay : 0;
}

module.exports = { today, addDays, diffInDays, calculateFine };
