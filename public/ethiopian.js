// Ethiopian (Ge'ez) calendar <-> Gregorian conversion via Julian Day Numbers.
// Works in the browser (window.EthCal) and in Node (module.exports) for testing.
(function (root) {
  const EPOCH = 1723856; // Amete Mihret epoch offset
  const UNIX_JDN = 2440588; // JDN of 1970-01-01

  const MONTHS = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'];
  const WEEKDAYS = ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'];

  const pad = (n) => String(n).padStart(2, '0');

  function isoToJdn(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000) + UNIX_JDN;
  }
  function jdnToIso(jdn) {
    const dt = new Date((jdn - UNIX_JDN) * 86400000);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }

  function ethToJdn(year, month, day) {
    return EPOCH + 365 + 365 * (year - 1) + Math.floor(year / 4) + 30 * month + day - 31;
  }
  function jdnToEth(jdn) {
    const r = (((jdn - EPOCH) % 1461) + 1461) % 1461;
    const n = (r % 365) + 365 * Math.floor(r / 1460);
    const year = 4 * Math.floor((jdn - EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
    return { year, month: Math.floor(n / 30) + 1, day: (n % 30) + 1 };
  }

  const toEth = (iso) => jdnToEth(isoToJdn(iso));
  const toIso = (year, month, day) => jdnToIso(ethToJdn(year, month, day));
  const daysInMonth = (year, month) => (month < 13 ? 30 : year % 4 === 3 ? 6 : 5);
  const weekday = (iso) => (isoToJdn(iso) + 1) % 7; // 0 = Sunday

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function addDays(iso, n) {
    return jdnToIso(isoToJdn(iso) + n);
  }
  function format(iso, { weekday: wd = false } = {}) {
    const e = toEth(iso);
    const s = `${MONTHS[e.month - 1]} ${e.day} ቀን ${e.year} ዓ.ም`;
    return wd ? `${WEEKDAYS[weekday(iso)]}፣ ${s}` : s;
  }
  // Gregorian date range [from, to] covering an Ethiopian month.
  function monthRange(year, month) {
    return { from: toIso(year, month, 1), to: toIso(year, month, daysInMonth(year, month)) };
  }

  const api = { MONTHS, WEEKDAYS, toEth, toIso, daysInMonth, weekday, todayIso, addDays, format, monthRange };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EthCal = api;
})(this);
