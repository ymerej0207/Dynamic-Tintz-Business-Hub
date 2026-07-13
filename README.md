# Dynamic Tintz OS V3.0 Cloud Test

Includes secure login, role-based dashboards, Angi leads, follow-up queue, contact-attempt logging, time clock, unpaid breaks, weekly hours, team time, and assigned jobs. Start with SETUP-V3.md.


## V3.0.1 Patch

Fixed the Team Time profile relationship by explicitly selecting the employee relationship through `time_entries_employee_id_fkey`. This removes the Supabase ambiguity between `employee_id` and `approved_by`.


## V3.1 Cloud Operations
- Cloud quote builder with customer records
- Quote recall and editing
- Ceramic list price, tier price, savings and deposit
- Enter-to-add measurement rows
- Owner shortcut hub
