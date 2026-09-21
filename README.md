# Clove House Hotel Operations

A premium internal hotel management system demo for hotels in Ethiopia. The interface is intentionally centered on day-to-day hotel operations rather than public booking.

## Run locally

This is a dependency-free browser app. From the repository root:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then open `http://localhost:4173`.

## Included operational flows

- Manager overview with occupancy, arrivals/departures, revenue mix, alerts and active stays
- Visual room and bed inventory map with live statuses
- Reservation pipeline and fast walk-in check-in
- Active stays and source-linked guest folios
- Room, food & beverage, service and payment transactions in one account
- Room charge flow from Restaurant POS to the guest folio
- Kitchen display system with live order progression
- Housekeeping turnover tasks and maintenance issue log
- Checkout review that creates a housekeeping task and marks the room dirty
- Management reports for occupancy, revenue mix, ADR and operational performance
- Configurable currency, exchange-rate, tax, permission and audit-log surfaces

The current build uses realistic in-memory demo data so the complete workflow can be demonstrated immediately. A production backend would persist the same domain records server-side with authentication, authorization, immutable financial entries and audit logging.
