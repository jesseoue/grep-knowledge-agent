import { requireUserSession } from '../lib/session'
import { getUsageSummary } from '../lib/usage'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const summary = await getUsageSummary(session.user.id)
  return summary
})
