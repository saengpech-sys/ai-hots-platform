import { apiPostAuth } from '@/services/apiClient'

export async function fetchCourseLeaderboard({
  courseId,
  timeframe = 'week',
  limit = 10,
  filter,
  sortBy = 'level', // 'level' | 'best' | 'avg'
}) {
  if (!courseId) throw new Error('courseId required')
  const body = { courseId, timeframe, limit, filter, sortBy }
  return apiPostAuth('/api/leaderboard', body)
}
