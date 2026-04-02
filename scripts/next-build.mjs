import { spawn } from 'node:child_process'

// Vercel (and some Linux CI images) occasionally crash Turbopack builds with EPIPE.
// Force the stable build pipeline in a cross-platform way.
process.env.NEXT_DISABLE_TURBOPACK = process.env.NEXT_DISABLE_TURBOPACK ?? '1'

const cmd = process.platform === 'win32' ? 'npx.cmd next build' : 'npx next build'
const child = spawn(cmd, { stdio: 'inherit', env: process.env, shell: true })

child.on('exit', (code) => process.exit(code ?? 1))

