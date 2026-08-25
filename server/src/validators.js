const USERNAME_REGEX = /^[A-Za-z0-9._-]{4,10}$/;
const PASSWORD_REGEX = /^[A-Za-z0-9._-]{6,16}$/;
const CURRENCIES = ["EUR", "USD", "ARS"];

function validateUsername(username) {
  if (typeof username !== "string") return "El usuario es obligatorio.";
  if (!USERNAME_REGEX.test(username)) {
    return "El usuario debe tener entre 4 y 10 caracteres, solo letras, numeros, puntos, guiones o guion bajo.";
  }
  return null;
}

function validatePassword(password) {
  if (typeof password !== "string") return "La contrasena es obligatoria.";
  if (!PASSWORD_REGEX.test(password)) {
    return "La contrasena debe tener entre 6 y 16 caracteres, solo letras, numeros, puntos, guiones o guion bajo.";
  }
  return null;
}

function validateCurrency(currency) {
  return CURRENCIES.includes(currency);
}

module.exports = {
  USERNAME_REGEX,
  PASSWORD_REGEX,
  CURRENCIES,
  validateUsername,
  validatePassword,
  validateCurrency,
};
