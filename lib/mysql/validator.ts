export class SafetyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SafetyError'
  }
}

const FIRST_TOKEN_ALLOWLIST = new Set([
  'select', 'show', 'describe', 'desc', 'explain', 'with', 'call',
])

const BODY_BLOCKLIST = [
  'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
  'rename', 'grant', 'revoke', 'merge', 'replace', 'load', 'outfile',
  'dumpfile', 'set', 'lock', 'unlock', 'use',
]

const BODY_BLOCKLIST_REGEX = new RegExp(
  `\\b(${BODY_BLOCKLIST.join('|')})\\b`, 'i'
)

export function validateQuery(sql: string): void {
  const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const normalised = stripped.replace(/\s+/g, ' ').trim().toLowerCase()

  if (!normalised) {
    throw new SafetyError('Empty query')
  }

  const firstToken = normalised.split(/\s/)[0]

  if (!FIRST_TOKEN_ALLOWLIST.has(firstToken)) {
    throw new SafetyError(`Disallowed SQL command: ${firstToken.toUpperCase()}`)
  }

  if (firstToken !== 'call') {
    const bodyAfterFirst = normalised.slice(firstToken.length)
    if (BODY_BLOCKLIST_REGEX.test(bodyAfterFirst)) {
      const match = bodyAfterFirst.match(BODY_BLOCKLIST_REGEX)
      throw new SafetyError(`Dangerous keyword in query body: ${match?.[1]?.toUpperCase()}`)
    }
  }

  const semiIndex = normalised.lastIndexOf(';')
  if (semiIndex !== -1 && semiIndex < normalised.length - 1) {
    throw new SafetyError('Multi-statement query detected')
  }

  if (firstToken === 'call') {
    const afterCall = normalised.slice(4).trim()
    const nameMatch = afterCall.match(/^([a-z_][a-z0-9_]*)\s*\(/i)
    if (!nameMatch) {
      throw new SafetyError(`Invalid stored procedure name: ${afterCall.split(/[\s(]/)[0] ?? '(none)'}`)
    }
  }
}
