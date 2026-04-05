export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36] as const
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35] as const

const RED_SET = new Set<number>(RED_NUMBERS)
const BLACK_SET = new Set<number>(BLACK_NUMBERS)

export type RouletteColor = 'red' | 'black' | 'green'

export function getNumberColor(n: number): RouletteColor {
  if (n === 0) return 'green'
  return RED_SET.has(n) ? 'red' : 'black'
}

export function isEven(n: number): boolean { return n !== 0 && n % 2 === 0 }
export function isOdd(n: number): boolean { return n !== 0 && n % 2 === 1 }
export function isLow(n: number): boolean { return n >= 1 && n <= 18 }
export function isHigh(n: number): boolean { return n >= 19 && n <= 36 }

export function getDozen(n: number): 0 | 1 | 2 | 3 {
  if (n === 0) return 0
  if (n <= 12) return 1
  if (n <= 24) return 2
  return 3
}

export function getColumn(n: number): 0 | 1 | 2 | 3 {
  if (n === 0) return 0
  return (((n - 1) % 3) + 1) as 1 | 2 | 3
}

// European Roulette: 0-36 wheel order
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const

export type RouletteBetType =
  | 'straight' | 'split' | 'street' | 'corner' | 'six_line'
  | 'basket' | 'dozen' | 'column'
  | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high'

export interface RouletteBetDef {
  type: RouletteBetType
  numbers: number[]
  amount: number
}

const PAYOUT_MAP: Record<RouletteBetType, number> = {
  straight: 35,
  split: 17,
  street: 11,
  corner: 8,
  six_line: 5,
  basket: 8,
  dozen: 2,
  column: 2,
  red: 1,
  black: 1,
  even: 1,
  odd: 1,
  low: 1,
  high: 1,
}

export function getPayoutMultiplier(betType: RouletteBetType): number {
  return PAYOUT_MAP[betType]
}

export function calculateBetPayout(bet: RouletteBetDef, winningNumber: number): number {
  if (bet.numbers.includes(winningNumber)) {
    return bet.amount * (getPayoutMultiplier(bet.type) + 1)
  }
  return 0
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / (0xFFFFFFFF + 1)
}

export function spinWheel(): number {
  const index = Math.floor(cryptoRandom() * 37)
  return WHEEL_ORDER[index]
}

// Validation helpers — every valid bet pattern for European Roulette
const VALID_STREETS = [
  [1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12],
  [13, 14, 15], [16, 17, 18], [19, 20, 21], [22, 23, 24],
  [25, 26, 27], [28, 29, 30], [31, 32, 33], [34, 35, 36],
]

function isValidSplit(nums: number[]): boolean {
  if (nums.length !== 2) return false
  const [a, b] = nums.sort((x, y) => x - y)
  if (a === 0) return b === 1 || b === 2 || b === 3
  const diff = b - a
  if (diff === 3) return true
  if (diff === 1) return Math.ceil(a / 3) === Math.ceil(b / 3)
  return false
}

function isValidCorner(nums: number[]): boolean {
  if (nums.length !== 4) return false
  const sorted = [...nums].sort((a, b) => a - b)
  const [a, b, c, d] = sorted
  if (a < 1 || d > 36) return false
  return (b === a + 1) && (c === a + 3) && (d === a + 4) &&
    Math.ceil(a / 3) === Math.ceil(b / 3)
}

function isValidSixLine(nums: number[]): boolean {
  if (nums.length !== 6) return false
  const sorted = [...nums].sort((a, b) => a - b)
  const base = sorted[0]
  if (base < 1 || base > 31 || base % 3 !== 1) return false
  for (let i = 0; i < 6; i++) {
    if (sorted[i] !== base + Math.floor(i / 3) * 3 + (i % 3)) return false
  }
  return true
}

export function validateBet(bet: RouletteBetDef): string | null {
  if (!Number.isFinite(bet.amount) || bet.amount <= 0) return 'Invalid bet amount'
  if (!bet.numbers || !Array.isArray(bet.numbers)) return 'Invalid numbers'

  for (const n of bet.numbers) {
    if (!Number.isInteger(n) || n < 0 || n > 36) return `Invalid number: ${n}`
  }

  switch (bet.type) {
    case 'straight':
      if (bet.numbers.length !== 1) return 'Straight bet must cover exactly 1 number'
      break
    case 'split':
      if (!isValidSplit(bet.numbers)) return 'Invalid split bet'
      break
    case 'street':
      if (bet.numbers.length !== 3) return 'Street bet must cover 3 numbers'
      if (!VALID_STREETS.some((s) => s.every((n, i) => [...bet.numbers].sort((a, b) => a - b)[i] === n)))
        return 'Invalid street bet numbers'
      break
    case 'corner':
      if (!isValidCorner(bet.numbers)) return 'Invalid corner bet'
      break
    case 'six_line':
      if (!isValidSixLine(bet.numbers)) return 'Invalid six-line bet'
      break
    case 'basket':
      if (bet.numbers.length !== 4) return 'Basket bet must cover 4 numbers'
      if (![0, 1, 2, 3].every((n) => bet.numbers.includes(n))) return 'Basket must cover 0, 1, 2, 3'
      break
    case 'dozen': {
      if (bet.numbers.length !== 12) return 'Dozen bet must cover 12 numbers'
      const sorted = [...bet.numbers].sort((a, b) => a - b)
      const valid = sorted[0] === 1 || sorted[0] === 13 || sorted[0] === 25
      if (!valid || sorted[11] !== sorted[0] + 11) return 'Invalid dozen bet'
      break
    }
    case 'column': {
      if (bet.numbers.length !== 12) return 'Column bet must cover 12 numbers'
      const col = bet.numbers[0] % 3 === 0 ? 3 : bet.numbers[0] % 3
      for (const n of bet.numbers) {
        if (n < 1 || n > 36 || (n % 3 === 0 ? 3 : n % 3) !== col) return 'Invalid column bet'
      }
      break
    }
    case 'red':
      if (bet.numbers.length !== 18 || !bet.numbers.every((n) => RED_SET.has(n))) return 'Invalid red bet'
      break
    case 'black':
      if (bet.numbers.length !== 18 || !bet.numbers.every((n) => BLACK_SET.has(n))) return 'Invalid black bet'
      break
    case 'even':
      if (bet.numbers.length !== 18 || !bet.numbers.every((n) => isEven(n))) return 'Invalid even bet'
      break
    case 'odd':
      if (bet.numbers.length !== 18 || !bet.numbers.every((n) => isOdd(n))) return 'Invalid odd bet'
      break
    case 'low':
      if (bet.numbers.length !== 18 || !bet.numbers.every((n) => isLow(n))) return 'Invalid low bet'
      break
    case 'high':
      if (bet.numbers.length !== 18 || !bet.numbers.every((n) => isHigh(n))) return 'Invalid high bet'
      break
    default:
      return `Unknown bet type: ${bet.type}`
  }

  return null
}
