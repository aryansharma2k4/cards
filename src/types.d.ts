declare module 'pokersolver' {
  interface SolvedCard { value: string; suit: string }
  export class Hand {
    static solve(cards: string[]): Hand
    static winners(hands: Hand[]): Hand[]
    name: string
    descr: string
    rank: number
    cards: SolvedCard[]
  }
}
declare module 'phe' {
  export function cardCodes(cards: string[]): number[]
  export function evaluateCardCodes(codes: number[]): number
}
