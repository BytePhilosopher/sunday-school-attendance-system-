// Ethiopian (Ge'ez) calendar <-> Gregorian conversion via Julian Day Numbers.
const EPOCH = 1723856; // Amete Mihret epoch offset
const UNIX_JDN = 2440588; // JDN of 1970-01-01

export const MONTHS = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'];
export const WEEKDAYS = ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'];
export const WEEKDAYS_SHORT = ['እሑ', 'ሰኞ', 'ማክ', 'ረቡ', 'ሐሙ', 'ዓር', 'ቅዳ'];

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

export const toEth = (iso) => jdnToEth(isoToJdn(iso));
export const toIso = (year, month, day) => jdnToIso(ethToJdn(year, month, day));
export const daysInMonth = (year, month) => (month < 13 ? 30 : year % 4 === 3 ? 6 : 5);
export const weekday = (iso) => (isoToJdn(iso) + 1) % 7; // 0 = Sunday
export const addDays = (iso, n) => jdnToIso(isoToJdn(iso) + n);

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatEth(iso, { weekday: withWeekday = false, year = true } = {}) {
  const e = toEth(iso);
  const s = `${MONTHS[e.month - 1]} ${e.day}${year ? ` ቀን ${e.year} ዓ.ም` : ''}`;
  return withWeekday ? `${WEEKDAYS[weekday(iso)]}፣ ${s}` : s;
}

export function formatGreg(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Gregorian ISO range covering an Ethiopian month.
export function monthRange(year, month) {
  return { from: toIso(year, month, 1), to: toIso(year, month, daysInMonth(year, month)) };
}

export function shiftMonth({ year, month }, delta) {
  let m = month + delta;
  let y = year;
  while (m < 1) { m += 13; y--; }
  while (m > 13) { m -= 13; y++; }
  return { year: y, month: m };
}
