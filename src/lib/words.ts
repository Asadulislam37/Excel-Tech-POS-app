// Amount in words, Bangladeshi style (lakh / crore) — used on printed invoices.
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function under1000(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + under1000(n % 100) : "");
}

export function takaInWords(amount: number | string): string {
  const value = Math.abs(Math.round(Number(amount) || 0));
  if (value === 0) return "Zero Taka Only.";

  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const rest = value % 1000;

  const parts = [
    crore && `${under1000(crore)} Crore`,
    lakh && `${under1000(lakh)} Lakh`,
    thousand && `${under1000(thousand)} Thousand`,
    rest && under1000(rest),
  ].filter(Boolean);

  return `${parts.join(" ")} Taka Only.`;
}
