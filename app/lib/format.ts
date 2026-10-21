export function daysAgoLabel(daysAgo: number | null) {
  if (daysAgo === null) return 'Not yet started'
  if (daysAgo === 0) return 'Today'
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo < 7) return `${daysAgo} days ago`
  const weeks = Math.round(daysAgo / 7)
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
}

// For items created during the demo. Only call after mount: it reads the clock.
export function timeAgo(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  return hours < 24 ? `${hours} hour${hours === 1 ? '' : 's'} ago` : `${Math.floor(hours / 24)} days ago`
}

export function average(nums: number[]) {
  return nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : 0
}

export function masteryColor(score: number) {
  return score >= 75 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626'
}
