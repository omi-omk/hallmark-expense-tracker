import { buildDeleteEmployeePayload } from '@/lib/workers/delete-actions'

describe('buildDeleteEmployeePayload', () => {
  it('builds a soft delete payload', () => {
    expect(buildDeleteEmployeePayload('soft')).toEqual({ mode: 'soft' })
  })

  it('builds a hard delete payload', () => {
    expect(buildDeleteEmployeePayload('hard')).toEqual({ mode: 'hard' })
  })
})
