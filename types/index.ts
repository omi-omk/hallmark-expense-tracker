export type Role = 'owner' | 'admin' | 'worker'

export interface Profile {
  id: string
  name: string
  title: string | null
  email: string
  role: Role
  low_balance_threshold: number
  is_active: boolean
  created_at: string
}

export interface FundTransfer {
  id: string
  worker_id: string
  amount: number
  note: string | null
  created_at: string
}

export interface Category {
  id: string
  name: string
  is_global: boolean
  is_system: boolean
  created_by: string | null
  created_at: string
}

export interface Expense {
  id: string
  worker_id: string
  category_id: string
  amount: number
  date: string
  comment: string | null
  image_url: string | null
  created_at: string
}

export interface Settings {
  owner_alert_email: string
  dashboard_show_category_spend: boolean
  dashboard_show_employee_spend: boolean
  dashboard_show_employee_cards: boolean
  dashboard_chart_order: 'category_first' | 'employee_first'
}

export interface WorkerWithBalance extends Profile {
  balance: number
}

export interface ExpenseWithCategory extends Expense {
  categories: { id?: string | null; name: string }
}

export interface ExpenseActivityLog {
  id: string
  expense_id: string | null
  worker_id: string
  actor_id: string | null
  actor_role: Role
  action: 'created' | 'edited' | 'deleted'
  old_values: unknown
  new_values: unknown
  created_at: string
}
