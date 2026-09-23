# Clove House — hotel operations system

One system for the whole hotel: the front desk sells and bills the rooms, the guest can
order from the room with a QR code, and the kitchen, barista and juice stations see
exactly their own tickets. Everything is live — a tap at the desk shows up on the station
screen in under a second.

Built as a real application: **React front end + Node/Express API + SQLite database**
(the old single-file demo lives in `legacy/`).

---

## Run it

```bash
npm install          # once
npm start            # API + built app  →  http://localhost:4000
```

Development (hot reload, API proxied):

```bash
npm run build        # build the React app into dist/
npm run dev          # API :4000  +  Vite dev server :5173
npm run reset-demo   # wipe the demo database and load fresh sample data
npm run smoke        # headless walkthrough of every role and screen (needs npm start)
```

The database is a single file: `server/data/clove.db`. Delete it (or run
`npm run reset-demo`) to start over.

### Demo sign-ins — PIN `1234` for all

| Role | Username | What they see |
| --- | --- | --- |
| Owner / Admin | `admin` | everything: rooms, prices, menu, staff, form builder, QR codes, reports, audit |
| Manager | `manager` | KPI dashboard, reports, housekeeping, maintenance |
| Cashier / Front desk | `cashier` | room board, check-in, orders, bills, payments |
| Waiter | `waiter` | ready orders to take to the rooms |
| Kitchen | `kitchen` | food tickets only |
| Barista | `barista` | coffee & bar tickets only |
| Juice station | `juice` | juice & soft-drink tickets only |
| Housekeeping | `housekeeping` | rooms to turn around |

---

## The working day, end to end

1. **Guest scans the QR code in the room** → menu opens on their phone → they tap items and send.
2. **The order rings the cashier full screen** (sound + red alert). She taps
   *Accept · called & confirmed* — that means she phoned the room and confirmed it.
3. She **sends** it; every item goes to its own station (kitchen / barista / juice).
4. The station taps **Accept** when it starts, **Done** when the plate leaves.
5. When everything on the order is done, the desk gets a **Send waiter** button.
6. The waiter delivers; **the money lands on the room bill automatically**.
7. At checkout the cashier taps **Paid & release** — the room becomes free, housekeeping
   gets a turnover task, and the money shows up in the admin reports.

No smartphone? The same screen has **Phone / walk-in order** and **Check a guest in**, so
the cashier can do all of it by hand.

### Registration

* **Guest self-registration:** QR code → room photos, price and details → the guest fills
  the form → it appears at the desk as *“waiting for the desk”* → one tap checks them in.
* **At the counter:** select the room → the form pops out → fill it → the room is occupied
  and the bill starts counting.

**The questions on that form are yours.** Admin → *Guest details* builds the registration
form: label in English and Amharic, type (text, number, phone, email, date, select,
textarea), required or not, options, order. Add “Plate number” for hotels with parking,
drop “Passport” if you never take foreign guests.

### Money

Three ways to sell a room, set per room type (and overridable per room):

| Mode | Charged |
| --- | --- |
| **Nightly** | every started 24 h counts as a night |
| **Day use** | every block of *N* hours (you set N) |
| **Hourly** | every started hour |

The bill is never a snapshot: the room charge is computed from the clock, so the cashier
always sees what the guest owes **right now**, plus food, service charges and discounts.
Payment can be split across methods (cash / telebirr / CBE / card), and a checkout can
correct the number of units if the guest leaves early or stays late.

Station prices land on the guest bill the moment an order is delivered, and every
check-in, payment, price change and void is written to the audit log.

---

## QR codes

Admin → *Print & stick*. Two codes per room:

* `/q/<room-token>` — the in-room code: menu, room info, the guest's own bill.
* `/r/<room-token>` — registration: photos, price, the guest form.

Set the *base address* to the address staff phones can reach (the LAN IP, or the public
URL) before printing — that is what gets encoded into the code.

---

## Where things live

```
client/            React app (pages, shared UI, styles)
  src/pages/       one file per screen; guest/ holds the two public QR pages
  src/lib/         api client, store (live data + toasts), icons, formatters, UI kit
server/            Express API
  routes-core.js   everything the floor needs (rooms, stays, orders, stations, reports)
  routes-admin.js  admin-only: CRUD, uploads, settings, audit
  actions.js       every write: check-in/out, payments, order lifecycle, housekeeping
  repo.js          every read: rooms grid with live totals, folio, order, menu, users
  reports.js       revenue, occupancy, daily close, trends, guest history
  db.js seed.js    schema + the demo dataset
shared/billing.js  billing maths and role/nav rules used by both sides
scripts/smoke.mjs  headless end-to-end check
```

---

## Notes

* Login is username + PIN (hashed, scrypt). Tokens last 12 hours and are kept in memory,
  so restarting the API signs everybody out.
* Photos are uploaded to `server/uploads/` and served from `/uploads`.
* Tax/service charge are settings: set them to 0 if you do not use them.
* Amharic labels sit next to the English ones on the buttons the floor uses every day;
  they are plain text in the source, so you can reword them.
