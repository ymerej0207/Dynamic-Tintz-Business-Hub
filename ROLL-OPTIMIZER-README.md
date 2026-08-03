# Roll Optimization Engine v5.7

## Files to replace on the target branch
- `app.js`
- `index.html`
- `styles.css`
- `service-worker.js`

## Supabase
Run `ROLL-OPTIMIZER-MIGRATION.sql` once if you want the **Save Plan** button to store plans in Supabase. The optimizer itself works without the migration.

## Workflow
1. Open **Roll Optimizer** from the navigation.
2. Load a saved quote or paste dimensions.
3. Enter roll width, remaining roll length, cutting-head count, and rotation rules.
4. Click **Optimize Roll**.
5. Print the installer plan or save it to the linked quote.

## Optimization objective
1. Lowest linear footage.
2. Lowest waste.
3. Fewest cutter changes.
4. Simplest pull sequence.

The browser engine compares multiple candidate strip-nesting layouts and returns only the highest-ranked plan found.
