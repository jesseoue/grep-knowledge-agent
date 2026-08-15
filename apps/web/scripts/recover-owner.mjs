#!/usr/bin/env node

import { randomBytes, randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { hashPassword } from 'better-auth/crypto'
import postgres from 'postgres'

const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 128

function readOption(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function printHelp() {
  console.log(`Grep Knowledge Agent owner recovery

Usage:
  node recover-owner.mjs [--email owner@example.com] [--generate] [--yes]

Options:
  --email       Existing owner email. You can choose interactively if omitted.
  --generate    Generate and print a strong temporary password after recovery.
  --yes         Skip the final confirmation (intended for controlled automation).
  --help        Show this help.

Run this inside the web service with Railway SSH. The script talks directly to
the private database, never opens public signup, and revokes existing sessions.`)
}

async function promptHidden(label) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('A TTY is required for hidden password entry. Re-run with --generate for a secure temporary password.')
  }

  process.stdout.write(label)
  process.stdin.setEncoding('utf8')
  process.stdin.setRawMode(true)
  process.stdin.resume()

  return new Promise((resolve, reject) => {
    let value = ''

    const finish = (error) => {
      process.stdin.off('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write('\n')
      if (error) reject(error)
      else resolve(value)
    }

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('Recovery cancelled.'))
        if (character === '\r' || character === '\n') return finish()
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
          continue
        }
        if (character >= ' ') value += character
      }
    }

    process.stdin.on('data', onData)
  })
}

function validatePassword(password) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`)
  }
}

async function chooseUser(sql, requestedEmail) {
  const users = await sql`
    select id, email, name, created_at
    from "user"
    order by created_at asc
  `

  if (users.length === 0) {
    throw new Error('No workspace account exists yet. Open /login and create the first owner account instead.')
  }

  if (requestedEmail) {
    const selected = users.find(user => user.email.toLowerCase() === requestedEmail.toLowerCase())
    if (!selected) throw new Error(`No account exists for ${requestedEmail}.`)
    return selected
  }

  if (users.length === 1) return users[0]

  console.log('Accounts in this deployment:')
  for (const [index, user] of users.entries()) {
    const ownerLabel = index === 0 ? ' (first owner)' : ''
    console.log(`  ${index + 1}. ${user.email}${ownerLabel}`)
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  const email = (await prompt.question('Owner email to recover: ')).trim()
  prompt.close()
  const selected = users.find(user => user.email.toLowerCase() === email.toLowerCase())
  if (!selected) throw new Error(`No account exists for ${email}.`)
  return selected
}

async function main() {
  if (hasFlag('--help')) {
    printHelp()
    return
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Run this script inside the Railway web service.')
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })

  try {
    const user = await chooseUser(sql, readOption('--email'))
    const generated = hasFlag('--generate')
    let password

    if (generated) {
      password = `${randomBytes(18).toString('base64url')}Aa1!`
    } else {
      password = await promptHidden('New password (hidden): ')
      const confirmation = await promptHidden('Confirm password (hidden): ')
      if (password !== confirmation) throw new Error('Passwords do not match.')
    }
    validatePassword(password)

    if (!hasFlag('--yes')) {
      const prompt = createInterface({ input: process.stdin, output: process.stdout })
      const confirmation = await prompt.question(`Type RESET ${user.email} to continue: `)
      prompt.close()
      if (confirmation !== `RESET ${user.email}`) throw new Error('Recovery cancelled.')
    }

    const passwordHash = await hashPassword(password)

    await sql.begin(async (transaction) => {
      const credentials = await transaction`
        select id
        from account
        where user_id = ${user.id} and provider_id = 'credential'
        for update
      `

      if (credentials.length > 0) {
        await transaction`
          update account
          set password = ${passwordHash}, updated_at = now()
          where user_id = ${user.id} and provider_id = 'credential'
        `
      } else {
        await transaction`
          insert into account (id, user_id, account_id, provider_id, password)
          values (${randomUUID()}, ${user.id}, ${user.id}, 'credential', ${passwordHash})
        `
      }

      await transaction`delete from session where user_id = ${user.id}`
    })

    console.log('\nOwner access recovered.')
    console.log(`Email: ${user.email}`)
    if (generated) console.log(`Temporary password: ${password}`)
    console.log('Existing sessions were revoked. Sign in, then change the password in Settings → Security.')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(`Recovery failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
