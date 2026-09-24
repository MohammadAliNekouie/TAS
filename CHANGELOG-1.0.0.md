# TAS Accounting App 1.0.0

## اصلاحات اصلی

- Historical moving-average inventory rebuild
- Inventory ledger and audit trail
- No direct stock editing after item creation
- Safer invoice validation and mandatory accounting mappings for posting
- More strict journal voucher balancing
- Login throttling
- CORS allow-list
- HttpOnly session cookie support
- Backward-compatible DB migrations
- Production/stock-adjustment inventory recalculation

## Verification

- `node --check` passed for every backend JavaScript source file.
- Full npm install/build could not be completed in the build environment because package installation timed out; native dependency compilation therefore remains a deployment-time verification step.
