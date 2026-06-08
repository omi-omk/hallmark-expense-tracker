export function startAppLoading() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('app-loading:start'))
}

export function stopAppLoading() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('app-loading:stop'))
}

export async function withAppLoading<T>(operation: () => Promise<T>): Promise<T> {
  startAppLoading()
  try {
    return await operation()
  } finally {
    stopAppLoading()
  }
}
