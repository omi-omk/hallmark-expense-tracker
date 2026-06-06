# Transaction UI Polish Design

## Goal

Make transactions feel consistent and touch-friendly for both owner/admin and employee users.

## Scope

- Employee transaction cards open full-page details instead of small dialogs.
- Owner/admin employee transaction rows open full-page details.
- Expense rows show a receipt icon when a photo exists.
- Transaction detail pages show amount, category, date/time, comment, employee context, and receipt image.
- The dashboard low-balance banner becomes actionable and anchors the owner to a low-balance employee section.
- Employee dashboard recent transactions become clickable.

## Routes

- Employee expense details: `/expenses/[id]`
- Owner/admin expense details: `/owner/transactions/expenses/[id]`

Fund transfers stay as list rows for this pass, but their visual affordance is improved. Expense detail pages are prioritized because receipts/photos belong to expenses.

## UI Behavior

Any expense with `image_url` shows an image icon beside the amount or category. The detail page shows the receipt image in a large, contained preview and a link to open it in a new tab. If no receipt exists, the page says `No receipt uploaded`.

The owner dashboard shows a clickable low-balance banner that links to `#low-balance-employees`. If there are low-balance employees, a separate section appears before the full employee list.

## Testing

Add unit tests for transaction URL builders so card links do not drift. Verify with the full Jest suite, production build, lint, and a local browser smoke check where possible.
