export type DeleteEmployeeMode = 'soft' | 'hard'

export interface DeleteEmployeePayload {
  mode: DeleteEmployeeMode
}

export function buildDeleteEmployeePayload(mode: DeleteEmployeeMode): DeleteEmployeePayload {
  return { mode }
}
