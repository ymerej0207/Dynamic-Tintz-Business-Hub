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


## V3.1.1 — Installer Job Dimensions

- Installers can open assigned jobs and view room names, width, height, quantity, and calculated square footage.
- Installers only receive quote measurements for jobs specifically assigned to their account.
- Project notes and total glass area are visible on the field job card.
- Pricing and owner financial information remain hidden.
- Run `V3.1.1-INSTALLER-DIMENSIONS-PATCH.sql` once in Supabase before testing.


## V3.2 — Schedule & Assign
- Jeremy can schedule and assign an installation directly from a saved cloud quote.
- Existing assignments can be edited.
- The quote is automatically marked Scheduled and assigned to the selected installer.
- Justin immediately receives the address, appointment, notes, room names, dimensions, quantities, and square footage.
- Run V3.2-SCHEDULE-ASSIGN-VERIFY.sql once before testing.


## V3.2.1 — Assignment and Quote Controls

- Owners can remove a scheduled job assignment while retaining the quote.
- Removing an assignment deletes the linked job, clears the assigned installer, and returns the quote to Approved.
- Owners can permanently delete a quote.
- Deleting a quote first removes linked job records so it disappears from the installer dashboard immediately.
- Customer records are preserved when a quote is deleted.
- Both destructive actions require confirmation.
