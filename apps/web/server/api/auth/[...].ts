import { getAuth } from '../../lib/auth'

export default defineEventHandler((event) => {
  const auth = getAuth()
  const path = event.path.replace(/^\/api\/auth/, '')
  return auth.handler({ req: event.node.req, res: event.node.res, path })
})
