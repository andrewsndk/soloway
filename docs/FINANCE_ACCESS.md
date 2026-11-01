# Finance visibility

Production admin build flags:

```text
VITE_FINANCE_ACCESS_CONTROL=true
VITE_VISIT_AMOUNTS_VISIBLE=true
```

Full finance access is reserved for `andrew`, `olena`, and `yulia` at
`@soloway.local`. Other staff retain operational booking and child-profile access,
including individual visit and subscription prices, payment status and package
activation. The two operational dashboard totals, received today and expected
payment for today, are visible to all staff. Other aggregate sums are masked;
Statistics, exports, receipts, settings
and the financial audit history are not available in their interface.

The database independently restricts cash expenses, receipt metadata/files,
audit-log reads and settings writes using the actual `auth.users` identity.
Editable user metadata does not confer finance access. Staff can still write
their normal audit entries.

This is not secrecy for individual prices: staff intentionally receive booking
amounts and can calculate their own totals from operational data. Booking and
subscription pricing/counter triggers are unchanged by this release. Manual
amount editing is disabled in the restricted UI, not a new database pricing rule.

SQL regression check on a production-shaped test database:
`psql -v ON_ERROR_STOP=1 -f supabase/tests/finance_access.sql`.
It uses transactions and leaves no records. Application pricing regressions:
`node --experimental-strip-types --test admin/src/lib/pricing.test.mjs admin/src/lib/subscription-payment.test.mjs`.
