/** Shapes returned by the backend functions in /backend/functions.
 *
 *  EIS reads now come from the live Domo Snowflake tables
 *  (DOMO.DOMO_UTIL."EIS_sf_*"), aliased to these snake_case names. Everything
 *  else — the shell's own config, org/RBAC, and commission sheets — lives in
 *  Retool DB (PostgreSQL). */

export type Module = {
  module_id: number
  code: string
  name: string
  short_label: string | null
  owner_label: string | null
  icon: string | null
  route_path: string
  sort_order: number
}

export type AppEntry = {
  app_id: number
  code: string
  name: string
  description: string | null
  icon: string | null
  launch_type: 'retool' | 'domo' | 'external' | 'embed' | 'placeholder'
  launch_target: string | null
  status: 'live' | 'beta' | 'planned' | 'deprecated'
  requires_eis_context: boolean
  sort_order: number
}

export type AppGroup = {
  app_group_id: number
  module_id: number | null
  code: string
  name: string
  icon: string | null
  parent_group_id: number | null
  sort_order: number
  apps: AppEntry[]
  children: AppGroup[]
}

export type Show = {
  show_code: string
  show_name: string
  show_nick_name: string | null
  show_type: string | null
  /** Derived, not stored: EIS has no group column. Show_Type 'M' is FMS. */
  show_group: 'fms' | 'legacy'
  is_active_production: number
}

/** One engagement joined to its tour, show, venue and city.
 *
 *  EIS stores status as single-letter codes; the `*_label` fields are the
 *  decoded descriptions from the EIS lookup tables, so the UI never shows a
 *  bare "EC" or "A". */
export type Engagement = {
  engagement_id: number
  contract_id: number | null
  sequence_number: number | null
  tour_id: number
  tour_name: string | null
  /** TEXT in EIS, and may be a span such as "2025-2026". Never parse to int. */
  tour_year: string | null
  routing_region: string | null
  tour_status: string | null
  tour_status_label: string | null
  fcp_unit: string | null
  show_code: string
  show_name: string | null
  show_nick_name: string | null
  show_group: 'fms' | 'legacy'
  venue_id: number | null
  venue_name: string | null
  venue_code: string | null
  venue_capacity: number | null
  venue_type: string | null
  venue_type_label: string | null
  city_id: number | null
  city_name: string | null
  state_country: string | null
  two_digit_code: string | null
  city_label: string | null
  engagement_type: string | null
  engagement_type_label: string | null
  show_type: string | null
  start_date: string | null
  end_date: string | null
  arrival_date: string | null
  departure_date: string | null
  contract_status: string | null
  contract_status_label: string | null
  engagement_status: string | null
  engagement_status_label: string | null
  tentative: boolean
  mileage: number | null
}

export type CurrentUser = {
  person_id: number
  upn: string
  display_name: string
  job_title: string | null
  department_name: string | null
  division_name: string | null
  roles: string[]
}

/** The EIS cascade, in the order Event Ops specifies: broadest scope first.
 *  `year` is a string because EIS Tour_Year is TEXT ("2026", "2025-2026"). */
export type EisContext = {
  showStatus: 'active' | 'inactive'
  year: string | null
  showGroup: 'fms' | 'legacy' | null
  showCode: string | null
  engagementId: number | null
}

/* ---------- Admin > Admin (RBAC) ---------- */

export type RbacDepartment = {
  division_name: string
  division_code: string
  department_name: string
  department_code: string
  headcount: number
  roles: string[]
}

export type RbacRole = {
  code: string
  name: string
  description: string | null
  scope_level: string
  people_count: number
  app_count: number
}

export type RbacPerson = {
  display_name: string
  job_title: string | null
  upn: string
  department_name: string | null
  division_name: string | null
  roles: string[]
}

export type RbacEntitlement = {
  role_code: string
  app_name: string
  app_code: string
  access_level: 'view' | 'edit' | 'admin'
}

export type RbacSnapshot = {
  departments: RbacDepartment[]
  roles: RbacRole[]
  people: RbacPerson[]
  entitlements: RbacEntitlement[]
}

/* ---------- POS Commission sheet ---------- */

export type CommissionLine = {
  line_id?: number
  line_no: number
  line_date: string | null
  order_no: string | null
  client: string | null
  amount: number
  commission_pct: number
}

export type CommissionSheet = {
  sheet_id: number
  engagement_id: number
  show_code: string | null
  tour_year: string | null
  period_from: string | null
  period_to: string | null
  salesperson_name: string | null
  commission_rate: number
  less_advance: number
  other_deductions: number
  notes: string | null
  status: 'draft' | 'submitted'
  submitted_at: string | null
  updated_at: string | null
  lines: CommissionLine[]
}

/** What the form posts back. `sheet_id` is absent on first save. */
export type CommissionSheetInput = {
  engagement_id: number
  show_code: string | null
  tour_year: string | null
  period_from: string | null
  period_to: string | null
  salesperson_name: string | null
  less_advance: number
  other_deductions: number
  notes: string | null
  status: 'draft' | 'submitted'
  person_id: number | null
  lines: CommissionLine[]
}

export type CommissionSaveResult = {
  ok: true
  sheet_id: number
  status: 'draft' | 'submitted'
  total_invoiced: number
  gross_commission: number
  amount_payable: number
}
