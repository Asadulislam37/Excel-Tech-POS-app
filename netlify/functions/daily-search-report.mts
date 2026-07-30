// Netlify Scheduled Function — fires once a day and asks the app to build +
// email the daily demand report. Runs at 03:00 UTC = 09:00 Asia/Dhaka.
// The heavy lifting (DB + email) lives in the Next.js route; this just triggers
// it with the shared secret.

export default async () => {
  const base = process.env.URL || "https://exceltechpos.netlify.app";
  const key = process.env.REPORTS_SECRET || "";
  try {
    const res = await fetch(`${base}/api/cron/search-daily?key=${encodeURIComponent(key)}`, { method: "POST" });
    const body = await res.text();
    console.log(`[daily-search-report] ${res.status} ${body.slice(0, 200)}`);
  } catch (e) {
    console.error("[daily-search-report] failed", e);
  }
  return new Response("ok");
};

export const config = { schedule: "0 3 * * *" };
