import type { BinaryToTextEncoding } from 'crypto'
const { randomBytes, createHash } = require('crypto')

// Get password from command line
const password = process.argv[2]

if (!password) {
  console.error('Please provide a password as an argument')
  console.error('Usage: ts-node scripts/generate-monitoring-hash.ts <password>')
  process.exit(1)
}

// Generate a random salt
const salt = randomBytes(32).toString('hex')

// Generate password hash
const hash = createHash('sha256')
  .update(password + salt)
  .digest('hex' as BinaryToTextEncoding)

console.log('\nAdd these values to your .env file:\n')
console.log(`MONITORING_AUTH_SALT=${salt}`)
console.log(`MONITORING_PASSWORD_HASH=${hash}\n`) 