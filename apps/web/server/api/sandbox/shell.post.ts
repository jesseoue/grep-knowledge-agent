import { z } from 'zod'
import { executeInSandbox } from '../../lib/sandbox'
import { requireUserSession } from '../../lib/session'

const bodySchema = z.object({
  command: z.string().min(1).max(2000).optional(),
  commands: z.array(z.string().min(1).max(2000)).max(10).optional(),
  sessionId: z.string().optional(),
}).refine(
  data => (data.command && !data.commands) || (!data.command && data.commands),
  { message: 'Provide either "command" or "commands", not both' },
)

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readValidatedBody(event, bodySchema.parse)
  const commands = body.commands || [body.command!]

  const { sessionId, results } = await executeInSandbox({
    commands,
    sessionId: body.sessionId,
  })

  if (commands.length === 1) {
    const r = results[0]!
    return { sessionId, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode }
  }

  return {
    sessionId,
    results: results.map(r => ({
      command: r.command,
      stdout: r.stdout,
      stderr: r.stderr,
      exitCode: r.exitCode,
    })),
  }
})
