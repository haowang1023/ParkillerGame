import { expect, it } from 'vitest'
import { toBoardData } from '../src/core/board/boardDefinition'
import { createPlayerState } from '../src/core/gameFlow/playerState'
import { TurnManager, type ParkillerMoveResult } from '../src/core/gameFlow/turnManager'
import { snapshotPiece } from '../src/core/pieces/piece'
import { applyMove, getValidMoves } from '../src/core/rules/parchisRules'
import { defaultRuleSettings } from '../src/core/rules/ruleSettings'
import { BOARD_DEFINITIONS } from '../src/data/boards'
import { getHopWaypoints, getParkillerMoveHopWaypoints } from '../src/scene/piecePosition'

// Reported directly: "El BOT no cuenta bien el número de casillas... cuenta una casilla más a veces".
// A piece visibly hops one square per pip, so these walk every real board, lane, start square and
// amount through the real rules engine and check the animation path has exactly that many hops.

it('hop count equals the move amount on every board, lane, start square and amount', () => {
  const mismatches: string[] = []
  let checked = 0
  for (const count of [2, 3, 4, 5, 6]) {
    const def = BOARD_DEFINITIONS[count]
    const board = toBoardData(def)
    for (const color of Object.keys(board.lanes)) {
      const lane = board.lanes[color as never] as { corridorLength: number }
      const starts: { state: 'OnTrack' | 'InHomeCorridor'; pos: number }[] = []
      for (let t = 0; t < board.trackLength; t++) starts.push({ state: 'OnTrack', pos: t })
      for (let c = 0; c < lane.corridorLength - 1; c++) starts.push({ state: 'InHomeCorridor', pos: c })
      for (const start of starts) {
        for (const amount of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
          const player = createPlayerState(color as never, board)
          const piece = player.pieces[0]
          piece.state = start.state
          if (start.state === 'OnTrack') piece.trackPosition = start.pos
          else piece.corridorPosition = start.pos
          const move = getValidMoves(board, player, [player], amount, defaultRuleSettings(), 'dieA').find((m) => m.piece === piece)
          if (!move) continue
          const before = snapshotPiece(piece)
          applyMove(board, move, [player], defaultRuleSettings(), false)
          const after = snapshotPiece(piece)
          const hops = getHopWaypoints(piece.color, before, after, def).length
          checked++
          if (hops !== amount) mismatches.push(`${count}p ${color} ${start.state}@${start.pos} +${amount} -> ${after.state}@${after.state === 'OnTrack' ? after.trackPosition : after.corridorPosition}: ${hops} hops`)
        }
      }
    }
  }
  expect(checked).toBeGreaterThan(10000)
  expect(mismatches).toEqual([])
})

it('Parkiller hop count equals its black die on every board, from the corridor and from the loop', () => {
  const mismatches: string[] = []
  let checked = 0
  for (const count of [2, 3, 4, 5, 6]) {
    const def = BOARD_DEFINITIONS[count]
    const board = toBoardData(def)
    const colors = Object.keys(board.lanes)
    for (const color of colors) {
      const probe = createPlayerState(color as never, board)
      const corridorLength = probe.parkiller.corridorLength
      const starts: { corridor: number; track: number }[] = []
      for (let c = 0; c < corridorLength; c++) starts.push({ corridor: c, track: probe.parkiller.trackPosition })
      for (let t = 0; t < board.trackLength; t += 3) starts.push({ corridor: corridorLength, track: t })
      for (const start of starts) {
        for (let die = 1; die <= 6; die++) {
          const players = colors.map((c) => createPlayerState(c as never, board))
          const me = players.find((p) => p.color === color)!
          me.parkiller.corridorPosition = start.corridor
          me.parkiller.trackPosition = start.track
          const others = players.filter((p) => p !== me)
          const ordered = [me, ...others]
          const seq = [2, 3, die]
          const tm = new TurnManager(board, ordered, defaultRuleSettings(), { roll: () => seq.shift() ?? 1 })
          let result: ParkillerMoveResult | null = null
          tm.parkillerMoved.on((r) => (result = r))
          tm.requestRoll()
          const r = result as ParkillerMoveResult | null
          if (!r) continue
          const hops = getParkillerMoveHopWaypoints(
            color as never,
            { trackPosition: r.before, corridorPosition: r.beforeCorridorPosition },
            { trackPosition: r.after, corridorPosition: r.afterCorridorPosition },
            def,
          ).length
          checked++
          if (hops !== die) mismatches.push(`${count}p ${color} corridor=${start.corridor}/${corridorLength} track=${start.track} die=${die}: ${hops} hops (corridor ${r.beforeCorridorPosition}->${r.afterCorridorPosition}, track ${r.before}->${r.after}, waypoints ${def.playerLanes.find((l) => l.color === color)!.homeCorridorWaypoints.length})`)
        }
      }
    }
  }
  expect(checked).toBeGreaterThan(3000)
  expect(mismatches).toEqual([])
})
