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
| Pastry & cake | `pastry` | cakes, pastry and dessert tickets only |
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
7. At checkout the cashier taps **Paid & release** — the room turns **purple (needs
   cleaning)** and the cleaning alarm rings on the housekeeping board *and* at the desk
   (most housekeepers here have no phone, so the cashier can see the room number and
   pass it on). When the room is done, either the housekeeper taps **Cleaned** on her
   board or the cashier taps **Cleaned** on the room — it turns **green (free)** again.
   A supervisor can mark it **Inspected** if your hotel double-checks rooms.

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

### The room board, colour by colour

| Colour | Status | Meaning |
| --- | --- | --- |
| 🟢 Green | Vacant clean / inspected | Free — sell it, tap it to show the guest |
| 🔴 Red | Occupied | A guest is in, the bill is counting |
| 🟣 Purple | Needs cleaning | Checkout done — housekeeping must clean it |
| 🔵 Blue | Being cleaned | The cleaner has started |
| 🟠 Amber | Reserved | Held for a booking |
| ⚫ Grey-violet | Maintenance / out of order | Blocked — the desk cannot sell it |

Nothing changes these by hand: checking a guest out turns the room purple, starting a
clean turns it blue, finishing turns it green (or inspected).

### Nothing is charged twice

Hotel Wi-Fi drops. Every risky submit — a payment, a check-out, a guest order — carries a
reference made by the device, and the database refuses to store the same reference twice.
If the tablet retries after a timeout, or a guest taps **Send order** twice, the system
answers with the original receipt instead of a second charge.

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

**The guest's currency.** At check-in the desk picks what the guest will pay in (birr,
dollar, euro, pound…). The rate of that moment is frozen on the stay, the whole bill is
quoted in that currency, and later payments are taken in it — the dollar amount and the
birr amount are both recorded, so the drawer adds up at the end of the shift.
The rate card lives in **Currency & rates**: press **Get official rates** to pull the
National Bank feed when there is internet, or type the rate by hand when there is not —
the cached rate keeps the desk working offline either way.

**A discount needs a manager.** Anything above the hotel's limit (%), set in *Hotel
settings*, stops at the desk: a manager types their own username and PIN, the server
issues a one-shot approval, and the folio records who allowed it. The check is on the
server, so it cannot be skipped from the browser.

---

## QR codes

Admin → *Print & stick*. Two codes per room:

* `/q/<room-token>` — the in-room code: menu, room info, the guest's own bill.
* `/r/<room-token>` — registration: photos, price, the guest form.

Set the *base address* to the address staff phones can reach (the LAN IP, or the public
URL) before printing — that is what gets encoded into the code.

### What the guest sees on the phone

Scanning the code on the bedside table opens exactly three doors:

| Door | What it does |
| --- | --- |
| **Menu watch and order** | the full menu with prices, order straight to the kitchen; it lands on the bill |
| **Special request** | one tap for food, water, towels, housekeeping, laundry, room service, something broken, a taxi or “I want to check out”, plus a free note (“Please bring 2 towels”) |
| **See bill** | everything charged to the room, what was already paid, and what is left |

A request never goes to a general inbox: housekeeping, the maintenance host, the waiter
and the desk each see only what belongs to them, and *something broken* also opens a
maintenance ticket in the same breath. Whoever picks it up taps **Accept**, then **Done**.
The guest sees the same list on their phone ("we are already looking after…"), so nobody
has to call the desk to ask whether the towels are coming.

Guests paying in dollars, euros or pounds see every amount in their own currency, at the
rate that was frozen when they checked in.

---

## The store room works by itself

**Inventory & recipes** links what leaves the shelf to what leaves the kitchen. A dish
with a recipe (4 ingredients of Doro wat, say) takes those ingredients off stock the
moment the station marks it done — nobody counts anything twice. The board then answers
the two questions the store room actually has:

* *what is below its minimum* — the shopping list, with a purchase request you can tick
  off when the delivery arrives;
* *what runs out in the next few days* — computed from the last week's real usage, not
  from a guess.

Each dish also shows its **plate cost** and margin next to the menu price, so a price can
be argued with numbers.

## When something breaks

Maintenance is a ladder, not a switch: **reported → assigned → being fixed → fixed →
signed off**. A high-priority report blocks the room so the desk cannot sell it; the
repair carries its cost; signing it off sends the room to housekeeping to be cleaned
before it goes back on sale. Open the clock icon on any ticket to see the room's history —
"third time this month" is usually the real problem.

## And the things that go missing

The **Lost & found** register is written once, with the shelf the item sits on, and shows
who found it and who returned it. When a guest rings three weeks later, reception answers
in seconds instead of walking to the store room.

**Identity documents** are photographed at check-in (camera or file) and kept on the guest
file, not on the phone at the desk. Opening a document is written to the audit log, and
scans older than the retention rule (*Hotel settings*, 90 days by default) can be purged
in one click.

---

## Checking it works

```bash
npm run smoke          # headless walkthrough: every role, every screen, the QR order loop
npm run test:api       # API checks: stations, cleaning flow, guest bill, double booking
npm run test:round3    # guest requests, maintenance ladder, approvals, inventory, fx
npm run test:security  # headers, authz, rate limits, injection, upload guards
npm run verify         # all of them, in order
```

The suites run against a live server (`npm start`) and are safe to run any time — the
smoke test resets the demo data first, and `test:security` pauses one username for a few
minutes on purpose (restart the API before a demo).

---

## Where things live

```
client/            React app (pages, shared UI, styles)
  src/pages/       one file per screen; guest/ holds the two public QR pages
  src/lib/         api client, store (live data + toasts), icons, formatters, UI kit
server/            Express API
  routes-core.js   everything the floor needs (rooms, stays, orders, stations, requests)
  routes-admin.js  admin-only: CRUD, uploads, settings, inventory, audit
  actions.js       every write: check-in/out, payments, order lifecycle, housekeeping
  ops.js           guest requests, maintenance ladder, approvals, inventory & recipes,
                   lost & found, identity documents
  fx.js            the rate card: official feed, cache, manual rates, frozen guest rates
  repo.js          every read: rooms grid with live totals, folio, order, menu, users
  reports.js       revenue, occupancy, daily close, trends, guest history
  security.js      gzip, caching, security headers, rate limits, error handling
  db.js seed.js    schema + the demo dataset and migrations
shared/billing.js  billing maths and role/nav rules used by both sides
scripts/           the verification suites (smoke, flows, round3, security)
```

---

## Notes

* Wrong PINs are counted per desk and username with a growing pause (30 s → 5 min) — and
  the manager can clear a pause instantly from **Admin → Audit log**, so a mischievous
  guest can never lock a cashier out for long.
* Login is username + PIN (hashed, scrypt). Tokens last 12 hours and are kept in memory,
  so restarting the API signs everybody out.
* Photos are uploaded to `server/uploads/` and served from `/uploads`.
* Tax/service charge are settings: set them to 0 if you do not use them.
* Amharic labels sit next to the English ones on the buttons the floor uses every day;
  they are plain text in the source, so you can reword them.
