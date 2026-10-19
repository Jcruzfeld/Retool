<plan_state>status=done</plan_state>
<resource_state>status=confirmed</resource_state>

# Feld HQ — update pass 3

An **update to the existing Feld HQ app**. The wiring from the previous passes is
correct and this tree carries it forward. Place these files; do not re-architect.

## Resources — CONFIRMED, now TWO

1. **`retool_db`** — `4a131fd9-0c80-4023-8f9c-d20abdbac9a8`, type `retoolDb`
   (PostgreSQL), global `retoolDb`. Everything Feld HQ **owns**: nav config,
   org/RBAC, and POS commission sheets. **All writes go here.**
2. **`Domo DB (read-only)`** — `937881d6-6298-49ba-b304-2023410fb5e3`, type
   `snowflake`, global `domoDbReadOnly`. The **EIS system of record**, read-only.

This is the change this pass exists for: EIS reads moved off the seeded Postgres
tables onto the live Domo Snowflake tables. The warehouse (`COMPUTE_WH`) and the
`DOMO` database are now attached, which they were not previously.

### EIS tables now in use (`DOMO.DOMO_UTIL`)

`EIS_sf_show` · `EIS_sf_tour` · `EIS_sf_engagement` · `EIS_sf_venue` ·
`EIS_sf_city`, plus the decode tables `EIS_sf_venue_type`,
`EIS_sf_engagement_type`, `EIS_sf_contract_status`, `EIS_sf_engagement_status`.

Three things about this data that are easy to get wrong:

1. **Identifiers are mixed-case**, so every table and column must be
   double-quoted. Output aliases are quoted lower-case on purpose so the driver
   returns `snake_case` keys rather than SHOUTING ones.
2. **`Tour_Year` is TEXT and may be a span** such as `"2025-2026"`. It is never
   parsed to an integer — it is sorted by `try_to_number(left(...,4))`. The whole
   `year` type changed from `number` to `string` across the app because of this.
3. **FMS vs Legacy is derived, not stored.** EIS has no group column. Event Ops
   defines FMS as `Show_Type = 'M'` (motorsport); everything else is Legacy. The
   `SHOW_GROUP_EXPR` constant in `hq.ts` is the single definition — keep the two
   filters using it in step.

Placeholders differ by driver: **`?` for Snowflake, `$1` for PostgreSQL.**

**The Postgres driver counts placeholder OCCURRENCES, not distinct numbers.**
Reusing `$10` twice in one statement fails the bind with a parameter-count
mismatch. Every `$N` in `saveCommissionSheet` appears exactly once, in ascending
order, and the submit timestamp is resolved in TypeScript rather than SQL for
that reason. Do not "simplify" it back into a `CASE`.

## Wiring conventions — unchanged, keep them

- One thin wrapper per backend function at `/backend/functions/<name>.ts`,
  default-exporting `(req: { params: … })` and delegating to `/backend/functions/hq.ts`.
- Backend-side types at `/backend/functions/types.ts` (a copy of `frontend/lib/types.ts`).
- The frontend calls backend functions through generated hooks in
  `/frontend/hooks/backend/functions.ts`, wrapped by `useApi()` in `/frontend/lib/api.ts`.
  `useApi()` is the single choke point.
- `useEis(api, initial)` takes the api client first.

**New backend functions this pass:** `getCommissionSheet.ts`, `saveCommissionSheet.ts`.
Regenerate `/frontend/hooks/backend/functions.ts` so `useGetCommissionSheet` and
`useSaveCommissionSheet` exist — `lib/api.ts` already imports them.

## What changed

1. **Apps menu renamed and restructured** (driven by rows in `hq_app_group` /
   `hq_app`, already migrated — no code change needed):
   - **Admin** → Admin, Dev
   - **Operations** → POS Commission, Live Event, Travel, Transportation, Digital Ads
   - **Intelligence** → Finance, Marketing, Events

   The old Brands subgroup and its five brand apps are deactivated, not deleted.

2. **The commission sheet is now a working form.** `pages/PosCommission.tsx`
   loads any saved sheet for the selected engagement, lets the user edit the
   period header, add and remove line rows, and **Save draft** or **Submit**.
   It writes to `fcp_commission_sheet` + `fcp_commission_line` in Retool DB.
   Totals shown while typing are computed in the browser; the figure reported
   after a save comes back from the `v_fcp_commission_totals` view, so the
   confirmed number is the database's arithmetic.

3. **EIS now reads live from Domo** (see above).

## Do not normalise

Carried over from the Domo "Event Ops" app on purpose:

1. **Headings use `Arial Narrow` with `font-stretch: 75%`.**
2. **`--green`, `--amber`, `--blue` all resolve to `#111`.** Status is carried by a
   soft background, never by coloured text.
3. **EIS filter order is `status → year → show group → show → engagement`.**
   Broadest scope first. Do not reorder or alphabetise.
4. **Accent `#fc0` is used sparingly** — active rail item (`inset 3px 0 0`), active
   subtab underline, focus rings, the avatar, and exactly one filled button
   (Submit sheet), because submitting is the point of that screen.
5. **Sidebar is pure black `#000`, fixed, 224px.**
6. **The brand mark is an inlined base64 PNG** in `feldhq.css`. Keep it inlined.
7. **Dates are split manually and rendered in UTC** in `lib/format.ts`.
   `new Date(str)` on an EIS `YYYY-MM-DD` shifts it a day in western timezones.
8. **No KPI strip on any module page.** The engagement facts live in the EIS bar
   at the top of the shell; a second copy mid-page reads as duplication. Do not
   add tiles back.
9. **No top tab bar.** Navigation is the left rail only.
10. **Commission inputs sit flush inside the ruled cells** — borders come from the
    cell, the input contributes only a focus tint. It should read as the paper
    form, not as a stack of web widgets.

## Stack

React 19 + Vite, plain CSS in `frontend/feldhq.css`. **No Tailwind utility classes
and no shadcn components in this app's own screens.** Do not convert the CSS to
Tailwind or swap the native `<select>` elements for Radix Select — the native
selects carry the exact prototype styling (custom chevron via layered
`linear-gradient` backgrounds).