const safeAbsolutePath = /^\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/

/** Resolve a shell-safe, non-root snapshot directory from the environment. */
export function getSnapshotDir(): string {
  const value = (process.env.SNAPSHOT_DIR || '/snapshot').replace(/\/+$/, '')
  if (!value || value === '/' || !safeAbsolutePath.test(value)) {
    throw new Error('SNAPSHOT_DIR must be a safe absolute path below the filesystem root')
  }
  return value
}
