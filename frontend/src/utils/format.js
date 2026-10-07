export function formatCurrency(
  centavos,
) {
  const pesos =
    Number(centavos || 0) / 100;

  return new Intl.NumberFormat(
    'en-PH',
    {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(pesos);
}
export function formatDate(
  value,
) {
  if (!value) {
    return '-';
  }

  const date =
    new Date(value);

  return new Intl.DateTimeFormat(
    'en-PH',
    {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    },
  ).format(date);
}