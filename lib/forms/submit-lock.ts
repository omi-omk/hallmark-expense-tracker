export interface SubmitLock {
  acquire: () => boolean
  release: () => void
}

export function createSubmitLock(): SubmitLock {
  let locked = false

  return {
    acquire() {
      if (locked) return false
      locked = true
      return true
    },
    release() {
      locked = false
    },
  }
}
