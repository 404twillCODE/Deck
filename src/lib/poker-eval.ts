import type { Card } from '@/types/game'

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

interface HandEvaluation {
  rank: number
  name: string
  highCards: number[]
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (arr.length < size) return []
  const [first, ...rest] = arr
  const withFirst = getCombinations(rest, size - 1).map((combo) => [first, ...combo])
  const withoutFirst = getCombinations(rest, size)
  return [...withFirst, ...withoutFirst]
}

function getStraightHigh(values: number[]): number {
  const unique = [...new Set(values)].sort((a, b) => b - a)
  if (unique.length < 5) return 0

  for (let i = 0; i <= unique.length - 5; i++) {
    let consecutive = true
    for (let j = 0; j < 4; j++) {
      if (unique[i + j] - unique[i + j + 1] !== 1) {
        consecutive = false
        break
      }
    }
    if (consecutive) return unique[i]
  }

  if (unique.includes(14) && unique.includes(5) && unique.includes(4) && unique.includes(3) && unique.includes(2)) {
    return 5
  }

  return 0
}

function evaluateFiveCards(cards: Card[]): HandEvaluation {
  const values = cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a)
  const suits = cards.map((c) => c.suit)

  const isFlush = suits.every((s) => s === suits[0])
  const straightHigh = getStraightHigh(values)
  const isStraight = straightHigh > 0

  const counts: Record<number, number> = {}
  for (const v of values) counts[v] = (counts[v] || 0) + 1
  const groups = Object.entries(counts)
    .map(([val, count]) => ({ val: parseInt(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val)

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { rank: 10, name: 'Royal Flush', highCards: [14, 13, 12, 11, 10] }
    }
    const hc = straightHigh === 5
      ? [5, 4, 3, 2, 1]
      : Array.from({ length: 5 }, (_, i) => straightHigh - i)
    return { rank: 9, name: 'Straight Flush', highCards: hc }
  }
  if (groups[0].count === 4) {
    return { rank: 8, name: 'Four of a Kind', highCards: [groups[0].val, groups[1].val] }
  }
  if (groups[0].count === 3 && groups[1].count === 2) {
    return { rank: 7, name: 'Full House', highCards: [groups[0].val, groups[1].val] }
  }
  if (isFlush) {
    return { rank: 6, name: 'Flush', highCards: values }
  }
  if (isStraight) {
    const hc = straightHigh === 5
      ? [5, 4, 3, 2, 1]
      : Array.from({ length: 5 }, (_, i) => straightHigh - i)
    return { rank: 5, name: 'Straight', highCards: hc }
  }
  if (groups[0].count === 3) {
    return { rank: 4, name: 'Three of a Kind', highCards: [groups[0].val, ...values.filter((v) => v !== groups[0].val)] }
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    return { rank: 3, name: 'Two Pair', highCards: [groups[0].val, groups[1].val, groups[2].val] }
  }
  if (groups[0].count === 2) {
    return { rank: 2, name: 'Pair', highCards: [groups[0].val, ...values.filter((v) => v !== groups[0].val)] }
  }
  return { rank: 1, name: 'High Card', highCards: values }
}

function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  for (let i = 0; i < Math.min(a.highCards.length, b.highCards.length); i++) {
    if (a.highCards[i] !== b.highCards[i]) return a.highCards[i] - b.highCards[i]
  }
  return 0
}

/**
 * Evaluate the best possible 5-card poker hand from a set of cards.
 * Works with 2 hole cards + up to 5 community cards.
 * Returns null if fewer than 5 total cards are available.
 */
export function evaluatePlayerHand(holeCards: Card[], communityCards: Card[]): HandEvaluation | null {
  const allCards = [...holeCards.filter((c) => c.faceUp), ...communityCards.filter((c) => c.faceUp)]
  if (allCards.length < 5) return null

  const allCombos = getCombinations(allCards, 5)
  let best: HandEvaluation = { rank: 0, name: '', highCards: [] }

  for (const combo of allCombos) {
    const evaluation = evaluateFiveCards(combo)
    if (compareHands(evaluation, best) > 0) {
      best = evaluation
    }
  }

  return best
}

/**
 * Get a readable description of what the player currently has,
 * considering just their hole cards if no community cards yet.
 */
export function describeHoleCards(holeCards: Card[]): string | null {
  const visible = holeCards.filter((c) => c.faceUp)
  if (visible.length < 2) return null

  const [a, b] = visible
  if (a.rank === b.rank) return 'Pair'
  if (a.suit === b.suit) return 'Suited'
  return 'High Card'
}
