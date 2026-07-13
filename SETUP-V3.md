# Dynamic Tintz OS V3.0 Setup

1. Open Supabase > SQL Editor > New query.
2. Paste all of `supabase-schema.sql` and click Run.
3. Open Authentication > Users > Add user. Create:
   - Jeremy: dynamictintzllc@gmail.com, role is assigned Owner automatically.
   - Justin: Jdogg2009@icloud.com, role is assigned Installer automatically.
4. Enable Auto Confirm User when creating each user and choose temporary passwords.
5. Open Authentication > URL Configuration and set the Site URL to your exact GitHub Pages app URL.
6. Upload these to GitHub Pages: index.html, app.js, styles.css, logo.png, manifest.webmanifest, service-worker.js, icons/.
7. Sign in as Jeremy and test Leads, Follow-Ups, and Team Time. Then sign in as Justin and test Clock In, unpaid breaks, Clock Out, and assigned jobs.

Never place a service-role key, database password, JWT secret, or Square token in GitHub.
