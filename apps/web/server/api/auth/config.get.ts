// Public auth config for the client — tells the UI which sign-in options are
// actually configured. GitHub OAuth only shows if the app has credentials.
export default defineEventHandler(() => {
  return {
    githubEnabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  }
})
