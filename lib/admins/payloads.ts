export interface AdminFormValues {
  name: string
  email: string
  password: string
}

export interface AdminUpdatePayload {
  name: string
  email: string
  password?: string
}

export function buildAdminUpdatePayload(form: AdminFormValues): AdminUpdatePayload {
  const payload: AdminUpdatePayload = {
    name: form.name.trim(),
    email: form.email.trim(),
  }
  const password = form.password.trim()
  if (password) payload.password = password
  return payload
}
