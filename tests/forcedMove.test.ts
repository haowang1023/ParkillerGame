import { describe, expect, it } from 'vitest'
import type { BoardData } from '../src/core/board/boardData'
import { createPlayerState } from '../src/core/gameFlow/playerState'
import { forcedMove } from '../src/core/rules/forcedMove'
import { getValidMoves } from '../src/core/rules/parchisRules'
import { defaultRuleSettings } from '../src/core/rules/ruleSettings'

function buildTestBoard(): BoardData {
  return {
    playerCount: 2,
    trackLength: 20,
    lanes: {
      Red: { color: 'Red', entryTrackIndex: 0, homeEntranceTrackIndex: 19, corridorLength: 6 },
      Blue: { color: 'Blue', entryTrackIndex: 10, homeEntranceTrackIndex: 9, corridorLength: 6 },
    },
    safeTrackIndices: new Set([0, 10]),
  }
}

// See forcedMove's own doc comment - "If you dont have choise, the Machine play inmidiatly".
describe('forcedMove', () => {
  it('plays an exit with a 5 automatically even with several pawns still in the shelter', () => {
    const board = buildTestBoard()
    const red = createPlayerState('Red', board)
    const moves = getValidMoves(board, red, [red], 5, defaultRuleSettings(), 'dieA')
    expect(moves.filter((m) => m.kind === 'ExitYard').length).toBe(4)

    const forced = forcedMove(moves)
    expect(forced?.kind).toBe('ExitYard')
  })

  it('plays the only option, a reward move included', () => {
    const board = buildTestBoard()
    const red = createPlayerState('Red', board)
    red.pieces[0].state = 'OnTrack'
    red.pieces[0].trackPosition = 2
    const moves = getValidMoves(board, red, [red], 10, defaultRuleSettings(), 'reward')
    expect(moves.length).toBe(1)

    expect(forcedMove(moves)).toBe(moves[0])
  })

  it('leaves the choice to the player when two different pieces can move', () => {
    const board = buildTestBoard()
    const red = createPlayerState('Red', board)
    red.pieces[0].state = 'OnTrack'
    red.pieces[0].trackPosition = 2
    red.pieces[1].state = 'OnTrack'
    red.pieces[1].trackPosition = 6

    expect(forcedMove(getValidMoves(board, red, [red], 3, defaultRuleSettings(), 'dieA'))).toBeNull()
  })

  it('leaves the choice when the same piece could move two different amounts', () => {
    const board = buildTestBoard()
    const red = createPlayerState('Red', board)
    red.pieces[0].state = 'OnTrack'
    red.pieces[0].trackPosition = 2
    const settings = defaultRuleSettings()
    const moves = [...getValidMoves(board, red, [red], 3, settings, 'dieA'), ...getValidMoves(board, red, [red], 4, settings, 'dieB')]

    expect(forcedMove(moves)).toBeNull()
  })

  it('does not treat two pawns sharing a square as interchangeable', () => {
    const board = buildTestBoard()
    const red = createPlayerState('Red', board)
    red.pieces[0].state = 'OnTrack'
    red.pieces[0].trackPosition = 2
    red.pieces[1].state = 'OnTrack'
    red.pieces[1].trackPosition = 2

    expect(forcedMove(getValidMoves(board, red, [red], 3, defaultRuleSettings(), 'dieA'))).toBeNull()
  })

  // "Cuando sale un 5 y hay peones en la casa y la salida está desocupada, debe salir el peón de
  // manera automática" - even when the other die still leaves a choice for later.
  it('plays the exit with a 5 when the exit square is free, even with other moves on offer', () => {
    const board = buildTestBoard()
    const red = createPlayerState('Red', board)
    red.pieces[0].state = 'OnTrack'
    red.pieces[0].trackPosition = 6
    const settings = defaultRuleSettings()
    const moves = [...getValidMoves(board, red, [red], 5, settings, 'dieA'), ...getValidMoves(board, red, [red], 3, settings, 'dieB')]
    expect(moves.some((m) => m.kind === 'TrackMove')).toBe(true)

    expect(forcedMove(moves, [red])?.kind).toBe('ExitYard')
  })

  it('leaves the choice to the player when something is already on the exit square', () => {
    const board = buildTestBoard()
    const red = createPlayerState('Red', board)
    const blue = createPlayerState('Blue', board)
    red.pieces[0].state = 'OnTrack'
    red.pieces[0].trackPosition = 6
    blue.pieces[0].state = 'OnTrack'
    blue.pieces[0].trackPosition = 0 // Red's exit square
    const settings = defaultRuleSettings()
    const moves = [...getValidMoves(board, red, [red, blue], 5, settings, 'dieA'), ...getValidMoves(board, red, [red, blue], 3, settings, 'dieB')]

    expect(forcedMove(moves, [red, blue])).toBeNull()
  })

  it('returns nothing when there is nothing to play', () => {
    expect(forcedMove([])).toBeNull()
  })
})
