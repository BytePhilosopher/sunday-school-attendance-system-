# የመዘምራን መቆጣጠሪያ — Attendance System

የደብረ ጽዮን ሰላም አርጊው ቅድስት ማርያም ሰ/ት/ቤት

A digital version of the handwritten choir attendance form (የመዘምራን መቆጣጠሪያ ቅጽ).
The interface is in Amharic and uses the Ethiopian calendar.

**Stack:** React (Vite) · Node.js / Express · PostgreSQL on [Neon](https://neon.tech)

## Features

- **ክትትል መያዝ (Take attendance):** Pick a day on an Ethiopian-calendar picker and tap a status
  for each member: ተገኝ (present), ቀሪ (absent), አርፍዷል (late) or ፈቃድ (excused). Each tap
  saves immediately. You can filter by status, search by name, and mark every remaining member
  at once.
- **ወርሃዊ ቅጽ (Monthly sheet):** The same grid as the paper form, for 1 or 3 months.
  It prints on A4 landscape with the logo and can be exported to Excel (CSV).
- **አባላት (Members):** Register new members and edit their details. Each member's
  attendance rate is shown; excused days don't count against them. A member who leaves can
  be marked inactive, which keeps their history.
- **ዋና ገጽ (Dashboard):** Today's progress, member totals, a chart of recent sessions, and a
  follow-up list of members absent 3 times in a row, with a call button.
- **ተጠቃሚዎች (User accounts):** Admins create logins for the people who take attendance.
  - *መዝጋቢ (recorder)* can take attendance and register members.
  - *አስተዳዳሪ (admin)* can also manage accounts and delete members.

On first start the app creates its tables and loads the 55 members from the paper form
(see `server/seed-members.js`).

## Setup

Requires **Node.js 22.12 or newer**.

1. Create a project at [neon.tech](https://neon.tech). From **Connection Details**, copy the
   connection string.
2. Configure and install:
   ```bash
   cp .env.example .env      # then paste your Neon string into DATABASE_URL
   npm install
   ```
3. Run:
   ```bash
   npm run dev               # development: http://localhost:5173
   ```
   or for production:
   ```bash
   npm run build && npm start   # http://localhost:3000
   ```

The first visit asks you to create the administrator account.

| Env var        | Purpose                                   |
|----------------|-------------------------------------------|
| `DATABASE_URL` | Neon (or any PostgreSQL) connection string |
| `PORT`         | API / production port, default `3000`     |

## Deploying

The app is one Node service: `npm run build` produces `dist/`, and `npm start` serves both
the API and the React app. It runs on any Node host (Render, Railway, Fly.io, a VPS) with
`DATABASE_URL` set. Neon handles backups and point-in-time restore.

## Structure

```
server/
  index.js           Express API (auth, members, attendance, dashboard)
  db.js              Postgres pool, schema, first-run seeding
  seed-members.js    Members from the handwritten form
client/
  index.html
  public/logo.png
  src/
    App.jsx          Auth gate + routes
    pages/           Dashboard, TakeAttendance, MonthlySheet, Members, Users, Login
    components/      Layout, EthDatePicker, modals/toasts, UI primitives
    lib/ethiopian.js Ethiopian ↔ Gregorian calendar conversion
    styles.css       Design system
```

Dates are stored as Gregorian `DATE` values. The browser converts them to the Ethiopian
calendar for display.
