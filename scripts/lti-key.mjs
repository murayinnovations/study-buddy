// Makes the key Study Buddy signs its learning-platform (LTI) messages with.
//
//   node scripts/lti-key.mjs
//
// Prints an LTI_PRIVATE_KEY line to paste into .env.local and into Vercel's environment
// variables. Make it once and keep it: platforms registered with one key keep checking
// against it, so a new key means registering again.
import { generateKeyPairSync } from 'node:crypto'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim()
console.log(`LTI_PRIVATE_KEY="${pem.replace(/\n/g, '\\n')}"`)
