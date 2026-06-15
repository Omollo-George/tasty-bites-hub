export const formatCurrency = (value: number, currencyCode: string = "KES") => {
  const locale = currencyCode === "KES" ? "en-KE" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(value);
};