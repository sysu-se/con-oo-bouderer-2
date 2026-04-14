import { describe, expect, it } from 'vitest'
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js'

describe('HW1.1 domain validation and stricter boundaries', () => {
  it('rejects malformed sudoku grids during creation', async () => {
    const { createSudoku } = await loadDomainApi()

    expect(() => createSudoku([[1, 2, 3]])).toThrow()
    expect(() => createSudoku(makePuzzle().map((row, index) => index === 0 ? [...row.slice(0, 8)] : row))).toThrow()
  })

  it('rejects invalid move values and out-of-range coordinates', async () => {
    const { createSudoku } = await loadDomainApi()
    const sudoku = createSudoku(makePuzzle())

    expect(() => sudoku.guess({ row: 0, col: 2, value: 10 })).toThrow()
    expect(() => sudoku.guess({ row: -1, col: 2, value: 4 })).toThrow()
    expect(() => sudoku.guess({ row: 0, col: 2, value: Number.NaN })).toThrow()
  })

  it('requires createGame to receive a real Sudoku object instead of a raw grid', async () => {
    const { createGame } = await loadDomainApi()

    expect(() => createGame({ sudoku: makePuzzle() })).toThrow()
  })
})
