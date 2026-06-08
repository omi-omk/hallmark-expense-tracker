import { buildAdminUpdatePayload } from '@/lib/admins/payloads'

describe('buildAdminUpdatePayload', () => {
  it('trims admin name and email', () => {
    expect(buildAdminUpdatePayload({ name: '  Omkar  ', email: '  omkar@example.com  ', password: '' })).toEqual({
      name: 'Omkar',
      email: 'omkar@example.com',
    })
  })

  it('includes password only when present', () => {
    expect(buildAdminUpdatePayload({ name: 'A', email: 'a@example.com', password: ' password123 ' })).toEqual({
      name: 'A',
      email: 'a@example.com',
      password: 'password123',
    })
  })
})
