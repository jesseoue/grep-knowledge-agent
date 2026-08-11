export default defineEventHandler(async () => {
  return {
    status: 'ok',
    service: 'grep-knowledge-agent',
    time: new Date().toISOString(),
  }
})
