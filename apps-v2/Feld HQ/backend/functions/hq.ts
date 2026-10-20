/** Feld HQ — shared queries.
 *
 *  TWO resources, split on purpose:
 *
 *  - `domoDbReadOnly` (Snowflake, DOMO.DOMO_UTIL) is the EIS system of record,
 *    read-only. Shows, tours, engagements, venues and cities come from here.
 *  - `retoolDb` (PostgreSQL) holds everything Feld HQ owns: the shell's nav
 *    config, the org/RBAC tables, and POS commission sheets. All writes go here.
 *
 *  Snowflake identifiers in DOMO_UTIL are mixed-case, so every table and column
 *  must be double-quoted. Output aliases are quoted lower-case so the driver
 *  returns snake_case keys instead of SHOUTING ones.
 *
 *  Placeholders differ by driver: `?` for Snowflake, `$1` for PostgreSQL. */

import type {
  AppGroup,
  CommissionSaveResult,
  CommissionSheet,
  CommissionSheetInput,
  CurrentUser,
  Engagement,
  Module,
  RbacSnapshot,
  Show,
} from './types'

const EIS = 'DOMO.DOMO_UTIL'

/** FMS vs Legacy is derived, not stored. Event Ops defines FMS as Show_Type 'M'
 *  (motorsport); everything else is Legacy. Keep the two in step. */
const SHOW_GROUP_EXPR = `case when upper(trim(s."Show_Type"))='M' then 'fms' else 'legacy' end`

/* ============================ shell config (Postgres) ============================ */

export async function listModules(): Promise<Module[]> {
  const { data } = await retoolDb.query<Module>(
    `SELECT module_id, code, name, short_label, owner_label, icon, route_path, sort_order
       FROM hq_module
      WHERE is_active
      ORDER BY sort_order, name`,
  )
  return data
}

export async function listAppGroups(): Promise<AppGroup[]> {
  const { data } = await retoolDb.query<any>(
    `SELECT module_id, app_group_id, group_code, group_name, group_icon, parent_group_id, group_sort,
            app_id, app_code, app_name, app_description, app_icon,
            launch_type, launch_target, app_status, requires_eis_context, app_sort
       FROM v_hq_nav
      WHERE app_group_id IS NOT NULL
      ORDER BY group_sort, app_sort, app_name`,
  )

  const groups = new Map<number, AppGroup>()
  for (const row of data) {
    let group = groups.get(row.app_group_id)
    if (!group) {
      group = {
        app_group_id: row.app_group_id,
        module_id: row.module_id,
        code: row.group_code,
        name: row.group_name,
        icon: row.group_icon,
        parent_group_id: row.parent_group_id,
        sort_order: row.group_sort,
        apps: [],
        children: [],
      }
      groups.set(row.app_group_id, group)
    }
    if (row.app_id) {
      group.apps.push({
        app_id: row.app_id,
        code: row.app_code,
        name: row.app_name,
        description: row.app_description,
        icon: row.app_icon,
        launch_type: row.launch_type,
        launch_target: row.launch_target,
        status: row.app_status,
        requires_eis_context: row.requires_eis_context,
        sort_order: row.app_sort,
      })
    }
  }

  const roots: AppGroup[] = []
  for (const group of groups.values()) {
    const parent = group.parent_group_id ? groups.get(group.parent_group_id) : undefined
    if (parent) parent.children.push(group)
    else roots.push(group)
  }
  return roots.sort((a, b) => a.sort_order - b.sort_order)
}

/* ============================== EIS reads (Snowflake) ============================== */

/** EIS filter 1 -> 2: the Tour_Year values that actually have routing.
 *
 *  Tour_Year is TEXT and can be a span ("2025-2026"), so it is sorted by the
 *  leading year rather than cast. Never parse it to an integer. */
export async function listShowYears(showStatus: 'active' | 'inactive'): Promise<string[]> {
  const { data } = await domoDbReadOnly.query<{ year: string }>(
    `select "year" from (
       select distinct t."Tour_Year" as "year", try_to_number(left(t."Tour_Year", 4)) as yn
         from ${EIS}."EIS_sf_tour" t
         join ${EIS}."EIS_sf_show" s on s."Show_Code" = t."Show_Code"
        where s."IsActiveProduction" = ?
          and t."Tour_Year" is not null and t."Tour_Year" <> ''
     ) order by yn desc nulls last`,
    [showStatus === 'active' ? 1 : 0],
  )
  return data.map((r) => r.year)
}

/** EIS filter 3 -> 4: shows routed in that year, within the chosen group.
 *
 *  Restricting to shows with a tour that year is what makes the list usable —
 *  EIS carries ~84 active shows, most with no routing in any given year. */
export async function listShows(
  showStatus: 'active' | 'inactive',
  year: string,
  showGroup: 'fms' | 'legacy',
): Promise<Show[]> {
  const { data } = await domoDbReadOnly.query<Show>(
    `select distinct
            s."Show_Code" as "show_code",
            s."Show_Name" as "show_name",
            s."Show_Nick_Name" as "show_nick_name",
            s."Show_Type" as "show_type",
            ${SHOW_GROUP_EXPR} as "show_group",
            s."IsActiveProduction" as "is_active_production"
       from ${EIS}."EIS_sf_show" s
       join ${EIS}."EIS_sf_tour" t on t."Show_Code" = s."Show_Code"
      where s."IsActiveProduction" = ?
        and t."Tour_Year" = ?
        and ${SHOW_GROUP_EXPR} = ?
      order by "show_name"`,
    [showStatus === 'active' ? 1 : 0, year, showGroup],
  )
  return data
}

/** The engagement projection, joined to tour / show / venue / city and with the
 *  single-letter EIS status codes decoded through their lookup tables. */
const ENGAGEMENT_SELECT = `
  select e."Engagement_ID" as "engagement_id",
         e."Contract_ID" as "contract_id",
         e."Sequence_No_in_Itinerary" as "sequence_number",
         t."Tour_ID" as "tour_id",
         t."Show_Tour_Name" as "tour_name",
         t."Tour_Year" as "tour_year",
         t."Routing_Region" as "routing_region",
         t."Tour_Status" as "tour_status",
         ts."description" as "tour_status_label",
         t."Fcp_Unit" as "fcp_unit",
         s."Show_Code" as "show_code",
         s."Show_Name" as "show_name",
         s."Show_Nick_Name" as "show_nick_name",
         ${SHOW_GROUP_EXPR} as "show_group",
         v."Venue_ID" as "venue_id",
         v."Venue_Name" as "venue_name",
         v."venue_code" as "venue_code",
         e."Venue_Capacity" as "venue_capacity",
         v."Venue_Type" as "venue_type",
         vt."Description" as "venue_type_label",
         c."City_ID" as "city_id",
         c."City_Name" as "city_name",
         c."statecountry" as "state_country",
         c."two_digit_code" as "two_digit_code",
         c."City_Name" || case when c."two_digit_code" is null or c."two_digit_code" = ''
                               then '' else ', ' || c."two_digit_code" end as "city_label",
         e."Engagement_Type" as "engagement_type",
         et."Engagement_Type_Name" as "engagement_type_label",
         e."Show_Type" as "show_type",
         e."Start_Date" as "start_date",
         e."End_Date" as "end_date",
         e."Arrival_Date" as "arrival_date",
         e."Departure_Date" as "departure_date",
         e."Contract_Status" as "contract_status",
         cs."Description" as "contract_status_label",
         e."Engagement_status" as "engagement_status",
         es."Description" as "engagement_status_label",
         (e."Tentative" = 1) as "tentative",
         e."Mileage" as "mileage"
    from ${EIS}."EIS_sf_engagement" e
    join ${EIS}."EIS_sf_tour" t on t."Tour_ID" = e."Tour_ID"
    join ${EIS}."EIS_sf_show" s on s."Show_Code" = t."Show_Code"
    left join ${EIS}."EIS_sf_venue" v on v."Venue_ID" = e."Venue_ID"
    left join ${EIS}."EIS_sf_city" c on c."City_ID" = v."City_ID"
    left join ${EIS}."EIS_sf_tour_status" ts on ts."tour_status" = t."Tour_Status"
    left join ${EIS}."EIS_sf_venue_type" vt on vt."Venue_Type" = v."Venue_Type"
    left join ${EIS}."EIS_sf_engagement_type" et on et."Engagement_Type" = e."Engagement_Type"
    left join ${EIS}."EIS_sf_contract_status" cs on cs."Contract_Status" = e."Contract_Status"
    left join ${EIS}."EIS_sf_engagement_status" es on es."Engagement_Status" = e."Engagement_status"`

/** EIS filter 5: engagements for the chosen show and year, in routing order. */
export async function listEngagements(showCode: string, year: string): Promise<Engagement[]> {
  const { data } = await domoDbReadOnly.query<Engagement>(
    `${ENGAGEMENT_SELECT}
      where s."Show_Code" = ? and t."Tour_Year" = ?
      order by e."Start_Date", e."Sequence_No_in_Itinerary"`,
    [showCode, year],
  )
  return data
}

export async function getEngagement(engagementId: number): Promise<Engagement | null> {
  const { data } = await domoDbReadOnly.query<Engagement>(
    `${ENGAGEMENT_SELECT} where e."Engagement_ID" = ?`,
    [engagementId],
  )
  return data[0] ?? null
}

/* ============================ identity + RBAC (Postgres) ============================ */

/** The saved EIS selection rides along with the user, so the shell boots on a
 *  single round trip instead of waiting on a second getUserContext call. */
export async function getCurrentUser(upn: string): Promise<CurrentUser | null> {
  const { data } = await retoolDb.query<any>(
    `SELECT p.person_id, p.upn, p.display_name, p.job_title,
            d.name AS department_name, dv.name AS division_name,
            COALESCE(
              (SELECT array_agg(r.code ORDER BY r.code)
                 FROM org_person_role pr
                 JOIN org_role r ON r.role_id = pr.role_id
                WHERE pr.person_id = p.person_id),
              ARRAY[]::text[]
            ) AS roles,
            CASE WHEN uc.person_id IS NULL THEN NULL ELSE json_build_object(
              'module_id', uc.module_id,
              'show_status', uc.show_status,
              'show_year', uc.show_year,
              'show_group', uc.show_group,
              'show_code', uc.show_code,
              'tour_id', uc.tour_id,
              'engagement_id', uc.engagement_id
            ) END AS context
       FROM org_person p
       LEFT JOIN org_department d ON d.department_id = p.department_id
       LEFT JOIN org_division dv ON dv.division_id = d.division_id
       LEFT JOIN hq_user_context uc ON uc.person_id = p.person_id
      WHERE lower(p.upn) = lower($1)
        AND p.is_active`,
    [upn],
  )
  return data[0] ?? null
}

export async function getUserContext(personId: number) {
  const { data } = await retoolDb.query(
    `SELECT module_id, show_status, show_year, show_group, show_code, tour_id, engagement_id
       FROM hq_user_context WHERE person_id = $1`,
    [personId],
  )
  return data[0] ?? null
}

export async function saveUserContext(
  personId: number,
  moduleId: number | null,
  showStatus: 'active' | 'inactive',
  showYear: string | null,
  showGroup: 'fms' | 'legacy' | null,
  showCode: string | null,
  engagementId: number | null,
) {
  await retoolDb.query(
    `INSERT INTO hq_user_context
       (person_id, module_id, show_status, show_year, show_group, show_code, engagement_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (person_id) DO UPDATE SET
       module_id = EXCLUDED.module_id,
       show_status = EXCLUDED.show_status,
       show_year = EXCLUDED.show_year,
       show_group = EXCLUDED.show_group,
       show_code = EXCLUDED.show_code,
       engagement_id = EXCLUDED.engagement_id,
       updated_at = now()`,
    [personId, moduleId, showStatus, showYear, showGroup, showCode, engagementId],
  )
  return { ok: true as const }
}

export async function listRbac(): Promise<RbacSnapshot> {
  const [departments, roles, people, entitlements] = await Promise.all([
    retoolDb.query<any>(
      `SELECT dv.name AS division_name, dv.code AS division_code,
              d.name AS department_name, d.code AS department_code,
              count(p.person_id)::int AS headcount,
              COALESCE(
                (SELECT array_agg(DISTINCT r.code ORDER BY r.code)
                   FROM org_person p2
                   JOIN org_person_role pr ON pr.person_id = p2.person_id
                   JOIN org_role r ON r.role_id = pr.role_id
                  WHERE p2.department_id = d.department_id),
                ARRAY[]::text[]
              ) AS roles
         FROM org_department d
         JOIN org_division dv ON dv.division_id = d.division_id
         LEFT JOIN org_person p ON p.department_id = d.department_id AND p.is_active
        GROUP BY dv.name, dv.code, d.name, d.code, d.department_id, dv.sort_order, d.sort_order
        ORDER BY dv.sort_order, d.sort_order`,
    ),
    retoolDb.query<any>(
      `SELECT r.code, r.name, r.description, r.scope_level,
              (SELECT count(*)::int FROM org_person_role pr WHERE pr.role_id = r.role_id) AS people_count,
              (SELECT count(*)::int FROM hq_app_role ar WHERE ar.role_id = r.role_id) AS app_count
         FROM org_role r
        WHERE r.is_active
        ORDER BY r.code`,
    ),
    retoolDb.query<any>(
      `SELECT p.display_name, p.job_title, p.upn,
              d.name AS department_name, dv.name AS division_name,
              COALESCE(
                (SELECT array_agg(r.code ORDER BY r.code)
                   FROM org_person_role pr
                   JOIN org_role r ON r.role_id = pr.role_id
                  WHERE pr.person_id = p.person_id),
                ARRAY[]::text[]
              ) AS roles
         FROM org_person p
         LEFT JOIN org_department d ON d.department_id = p.department_id
         LEFT JOIN org_division dv ON dv.division_id = d.division_id
        WHERE p.is_active
        ORDER BY p.display_name`,
    ),
    retoolDb.query<any>(
      `SELECT r.code AS role_code, a.name AS app_name, a.code AS app_code, ar.access_level
         FROM hq_app_role ar
         JOIN org_role r ON r.role_id = ar.role_id
         JOIN hq_app a ON a.app_id = ar.app_id
        WHERE a.is_active
        ORDER BY r.code, a.sort_order, a.name`,
    ),
  ])

  return {
    departments: departments.data,
    roles: roles.data,
    people: people.data,
    entitlements: entitlements.data,
  }
}

/* ========================= POS commission sheet (Postgres) ========================= */

/** One sheet per engagement. Returns null when nothing has been saved yet, so
 *  the form knows to start blank rather than showing someone else's numbers. */
export async function getCommissionSheet(engagementId: number): Promise<CommissionSheet | null> {
  const { data } = await retoolDb.query<any>(
    `SELECT sheet_id, engagement_id, show_code, tour_year, period_from, period_to,
            salesperson_name, commission_rate, less_advance, other_deductions,
            notes, status, submitted_at, updated_at
       FROM fcp_commission_sheet
      WHERE engagement_id = $1`,
    [engagementId],
  )
  const sheet = data[0]
  if (!sheet) return null

  const lines = await retoolDb.query<any>(
    `SELECT line_id, line_no, line_date, order_no, client, amount, commission_pct
       FROM fcp_commission_line
      WHERE sheet_id = $1
      ORDER BY line_no`,
    [sheet.sheet_id],
  )

  return {
    ...sheet,
    commission_rate: Number(sheet.commission_rate),
    less_advance: Number(sheet.less_advance),
    other_deductions: Number(sheet.other_deductions),
    lines: lines.data.map((l) => ({
      ...l,
      amount: Number(l.amount),
      commission_pct: Number(l.commission_pct),
    })),
  }
}

/** Upsert the sheet and replace its lines.
 *
 *  Lines are deleted and re-inserted rather than diffed: the form posts the
 *  whole grid, rows get reordered and removed freely, and a sheet is a few dozen
 *  rows at most. Totals are read back from v_fcp_commission_totals so the
 *  number the user sees after saving is the database's, not the browser's. */
export async function saveCommissionSheet(input: CommissionSheetInput): Promise<CommissionSaveResult> {
  const submitting = input.status === 'submitted'

  // The submit stamp is resolved here rather than in SQL. The driver counts
  // placeholder OCCURRENCES, not distinct numbers, so reusing $10 twice in a
  // CASE makes the bind fail with a parameter-count mismatch. Each $N appears
  // exactly once below, in ascending order.
  const submittedAt = submitting ? new Date().toISOString() : null
  const submittedBy = submitting ? input.person_id : null

  const upsert = await retoolDb.query<{ sheet_id: number }>(
    `INSERT INTO fcp_commission_sheet
       (engagement_id, show_code, tour_year, period_from, period_to, salesperson_name,
        less_advance, other_deductions, notes, status, submitted_at, submitted_by, created_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11::timestamptz, $12::integer, $13::integer, now())
     ON CONFLICT (engagement_id) DO UPDATE SET
       show_code = EXCLUDED.show_code,
       tour_year = EXCLUDED.tour_year,
       period_from = EXCLUDED.period_from,
       period_to = EXCLUDED.period_to,
       salesperson_name = EXCLUDED.salesperson_name,
       less_advance = EXCLUDED.less_advance,
       other_deductions = EXCLUDED.other_deductions,
       notes = EXCLUDED.notes,
       status = EXCLUDED.status,
       -- keep the first submission's timestamp if it is resubmitted
       submitted_at = CASE WHEN EXCLUDED.status = 'submitted'
                           THEN COALESCE(fcp_commission_sheet.submitted_at, EXCLUDED.submitted_at)
                           ELSE NULL END,
       submitted_by = CASE WHEN EXCLUDED.status = 'submitted' THEN EXCLUDED.submitted_by ELSE NULL END,
       updated_at = now()
     RETURNING sheet_id`,
    [
      input.engagement_id,
      input.show_code,
      input.tour_year,
      input.period_from,
      input.period_to,
      input.salesperson_name,
      input.less_advance,
      input.other_deductions,
      input.notes,
      submitting ? 'submitted' : 'draft',
      submittedAt,
      submittedBy,
      input.person_id,
    ],
  )
  const sheetId = upsert.data[0].sheet_id

  await retoolDb.query(`DELETE FROM fcp_commission_line WHERE sheet_id = $1`, [sheetId])

  // Drop rows the user left completely blank so the paper-form filler rows do
  // not become empty records.
  const lines = (input.lines ?? [])
    .filter((l) => (l.order_no ?? '').trim() || (l.client ?? '').trim() || Number(l.amount) > 0)
    .map((l, index) => ({
      line_no: index + 1,
      line_date: l.line_date || null,
      order_no: l.order_no || null,
      client: l.client || null,
      amount: Number(l.amount) || 0,
      commission_pct: Number(l.commission_pct) || 0,
    }))

  if (lines.length) {
    await retoolDb.query(
      `INSERT INTO fcp_commission_line
         (sheet_id, line_no, line_date, order_no, client, amount, commission_pct)
       SELECT $1::integer, line_no, line_date, order_no, client, amount, commission_pct
         FROM jsonb_to_recordset($2::jsonb) AS line(
           line_no integer,
           line_date date,
           order_no text,
           client text,
           amount numeric,
           commission_pct numeric
         )`,
      [sheetId, JSON.stringify(lines)],
    )
  }

  const totals = await retoolDb.query<any>(
    `SELECT total_invoiced, gross_commission, amount_payable, status
       FROM v_fcp_commission_totals WHERE sheet_id = $1`,
    [sheetId],
  )
  const t = totals.data[0] ?? {}

  return {
    ok: true,
    sheet_id: sheetId,
    status: submitting ? 'submitted' : 'draft',
    total_invoiced: Number(t.total_invoiced ?? 0),
    gross_commission: Number(t.gross_commission ?? 0),
    amount_payable: Number(t.amount_payable ?? 0),
  }
}
