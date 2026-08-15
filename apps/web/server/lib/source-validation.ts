import { z } from 'zod'

export const repoPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/
export const branchPattern = /^(?!-)(?!.*(?:\.\.|\/\/|@\{|[~^:?*[\]\\]))(?!.*(?:[/.]$|\.lock$))[A-Za-z0-9._/-]{1,100}$/
export const contentPathPattern = /^(?![-/])(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\/\/)[A-Za-z0-9._/-]{1,240}$/

export const repoSchema = z.string().trim().transform((value) => {
  return value
    .replace(/^https?:\/\/(?:www\.)?github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\/$/, '')
    .replace(/\.git$/i, '')
}).pipe(z.string().regex(repoPattern, 'Repository must be "owner/repo" or a GitHub repository URL'))
export const branchSchema = z.string().trim().regex(branchPattern, 'Enter a valid Git branch')
export const contentPathSchema = z.string().trim().max(240).refine(
  value => value === '' || contentPathPattern.test(value),
  'Content path must be a safe relative repository path',
)
