# Dashboard Customization Design

## Goal

Add a simple owner/admin dashboard customization flow that shows employee-wise spend, supports optional employee titles, and lets admins control which dashboard sections appear.

## Scope

- Add an employee-wise spend pie chart to the owner dashboard.
- Add an optional employee title/designation on employee profiles.
- Add dashboard customization controls in Settings.
- Keep the dashboard mobile-friendly and avoid drag-and-drop layout complexity.

## Data Model

`profiles` gets a nullable `title` column. This stores optional labels such as `Manager`, `Site Supervisor`, or `Driver`.

`settings` gets three dashboard settings:

- `dashboard_show_category_spend boolean default true`
- `dashboard_show_employee_spend boolean default true`
- `dashboard_show_employee_cards boolean default true`
- `dashboard_chart_order text default 'category_first'`, constrained to `category_first` or `employee_first`

The defaults preserve the current dashboard while adding the new employee-wise chart.

## Dashboard Behavior

The owner dashboard reads settings and renders:

- Category spend pie chart when `dashboard_show_category_spend` is true.
- Employee-wise spend pie chart when `dashboard_show_employee_spend` is true.
- Employee cards when `dashboard_show_employee_cards` is true.

When both charts are visible, `dashboard_chart_order` decides which chart appears first. If all dashboard sections are hidden, the dashboard shows a short empty-state message instead of a blank page.

## Employee Titles

Employee creation and employee credential editing accept an optional title. The title appears below the employee name on:

- owner dashboard employee cards
- employee list page
- employee detail page

The title is optional and never required for employee creation or update.

## Settings UI

Settings gets a `Dashboard` card with:

- checkboxes for the three visible dashboard sections
- a select control for chart order
- one save button with double-submit prevention

Only owner/admin users can access this settings page under the existing owner route protection.

## Testing

Add unit coverage for employee-wise spend grouping and dashboard setting defaults. Existing full tests, build, and lint must pass before commit and deployment.

## Deployment

Push to `main`. If Vercel Git integration is active, this will trigger production deployment automatically. If needed, run `vercel --prod` from the project root after verification.
