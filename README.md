# የመዘምራን መቆጣጠሪያ — Attendance System

የደብረ ጽዮን ሰላም አርጊው ቅድስት ማርያም ሰ/ት/ቤት

A digital version of the handwritten choir attendance form (የመዘምራን መቆጣጠሪያ ቅጽ).
The interface is in Amharic and uses the Ethiopian calendar.

## Features

- **ክትትል መያዝ (Take attendance):** Pick an Ethiopian date and tap a status for each member:
  ✓ present, ✗ absent, ◐ late or ፈ excused. Each tap saves immediately. There are
  buttons to mark everyone still unmarked as present or absent.
- **ወርሃዊ ቅጽ (Monthly sheet):** The same grid as the paper form (ተ.ቁ, ስም, ፆታ, then the days),
  for 1 or 3 months. It prints on A4 landscape with the logo and can be exported to Excel/CSV.
- **አባላት (Members):** Register new members and edit their details (phone, group, join date, notes).
  Each member's attendance percentage is shown. A member who leaves can be marked inactive,
  which keeps their history.
- **ዋና ገጽ (Dashboard):** Member totals, recent sessions, average attendance, and a follow-up list
  of members absent for the last 3 sessions, with their phone numbers.
- **ተጠቃሚዎች (User accounts):** Admins create logins for the people who take attendance.
  - *መዝጋቢ (recorder)* can take attendance and register members.
  - *አስተዳዳሪ (admin)* can also manage accounts and delete members or sessions.

On first start, the 55 members from the paper form are loaded automatically (see `seed-members.js`).

## Running

Requires **Node.js 22.13 or newer**, which includes SQLite, so nothing needs compiling.

```bash
npm install
npm start          # http://localhost:3000
```

The first visit asks you to create the administrator account.

| Env var    | Default  | Purpose                            |
|------------|----------|------------------------------------|
| `PORT`     | `3000`   | HTTP port                          |
| `DATA_DIR` | `./data` | Where `attendance.db` is stored    |

**Backup:** copy `data/attendance.db`. It holds all the data.

## Structure

```
server.js          Express API (auth, members, attendance, dashboard)
db.js              SQLite schema + first-run seeding
seed-members.js    Members from the handwritten form
public/            Frontend (vanilla JS, no build step)
  ethiopian.js     Ethiopian ↔ Gregorian calendar conversion
```

Dates are stored as Gregorian ISO dates (`YYYY-MM-DD`). The browser converts them to the
Ethiopian calendar for display.
