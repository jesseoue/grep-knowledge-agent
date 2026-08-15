import { allowsPublicSignup, isWorkspaceClaimed } from '../../lib/registration'

// Public auth config for the client — tells the UI which sign-in options are
// actually available. Registration closes after the first owner by default.
export default defineEventHandler(async () => {
  const workspaceClaimed = await isWorkspaceClaimed()

  return {
    githubEnabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    signupEnabled: allowsPublicSignup() || !workspaceClaimed,
    workspaceClaimed,
  }
})
