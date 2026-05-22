export type Role = 'owner' | 'worker'

export interface Profile {
  id: string
  name: string
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
}

export interface WorkerWithBalance extends Profile {
  balance: number
}

export interface ExpenseWithCategory extends Expense {
  categories: { name: string }
}
