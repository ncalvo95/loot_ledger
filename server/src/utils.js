// SQLite datetime('now') guarda 'YYYY-MM-DD HH:MM:SS' en UTC sin sufijo de zona.
function parseSqliteUTC(value) {
  if (!value) return null;
  return new Date(value.replace(" ", "T") + "Z");
}

module.exports = { parseSqliteUTC };
