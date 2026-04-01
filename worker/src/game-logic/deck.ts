import type { Card, Suit, Rank } from '../types'

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

function cryptoRandom(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / (0xFFFFFFFF + 1)
}

export class Deck {
  private cards: Card[] = []

  constructor(numDecks = 1) {
    this.reset(numDecks)
  }

  reset(numDecks = 1) {
    this.cards = []
    for (let d = 0; d < numDecks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push({ suit, rank, faceUp: true })
        }
      }
    }
    this.shuffle()
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(cryptoRandom() * (i + 1))
      ;[this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]]
    }
  }

  deal(faceUp = true): Card {
    if (this.cards.length === 0) {
      this.reset()
    }
    const card = this.cards.pop()!
    card.faceUp = faceUp
    return card
  }

  get remaining(): number {
    return this.cards.length
  }
}

export function getCardValue(card: Card): number {
  if (['J', 'Q', 'K'].includes(card.rank)) return 10
  if (card.rank === 'A') return 11
  return parseInt(card.rank)
}

export function getHandValue(cards: Card[]): number {
  let value = 0
  let aces = 0

  for (const card of cards) {
    if (!card.faceUp) continue
    if (card.rank === 'A') {
      aces++
      value += 11
    } else {
      value += getCardValue(card)
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return value
}

export function getFullHandValue(cards: Card[]): number {
  let value = 0
  let aces = 0

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++
      value += 11
    } else {
      value += getCardValue(card)
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return value
}

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

export interface HandEvaluation {
  rank: number
  name: string
  highCards: number[]
}

export function evaluatePokerHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5) {
    return { rank: 0, name: 'Incomplete', highCards: [] }
  }

  const allCombos = getCombinations(cards, 5)
  let best: HandEvaluation = { rank: 0, name: '', highCards: [] }

  for (const combo of allCombos) {
    const evaluation = evaluateFiveCards(combo)
    if (compareHands(evaluation, best) > 0) {
      best = evaluation
    }
  }

  return best
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

  // Wheel: A-2-3-4-5
  if (unique.includes(14) && unique.includes(5) && unique.includes(4) && unique.includes(3) && unique.includes(2)) {
    return 5
  }

  return 0
}

export function compareHands(a: HandEvaluation, b: HandEvaluation): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  for (let i = 0; i < Math.min(a.highCards.length, b.highCards.length); i++) {
    if (a.highCards[i] !== b.highCards[i]) return a.highCards[i] - b.highCards[i]
  }
  return 0
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (arr.length < size) return []
  const [first, ...rest] = arr
  const withFirst = getCombinations(rest, size - 1).map((combo) => [first, ...combo])
  const withoutFirst = getCombinations(rest, size)
  return [...withFirst, ...withoutFirst]
}
