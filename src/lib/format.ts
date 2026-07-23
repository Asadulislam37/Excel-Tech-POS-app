export const taka = (n: number | string) =>
  "\u09F3" + Number(n).toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const dt = (d: string | Date) =>
  new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
