import type { MoveOption } from './moveOption'

// The move to play automatically when the player has no real choice, or null when they do.
// Requested directly, twice: "las jugadas obligatorias deberian de ser gestionadas por el juego,
// como por ejemplo salir con 5", then "If you dont have choise, the Machine play inmidiatly... The
// game has to be faster". One option is obviously forced, but exiting with a 5 offers one ExitYard
// per pawn still in the shelter - all identical, since shelter pawns are interchangeable - so the
// player was still being asked to pick one. Pieces already on the board keep their identity even
// when two share a square: one of them may have moved earlier this roll, which changes what landing
// on a Parkiller does (PK6), and a MoveOption doesn't carry that.
export function forcedMove(moves: readonly MoveOption[]): MoveOption | null {
  if (moves.length === 0) return null
  const key = (m: MoveOption) =>
    [
      m.piece.state === 'InYard' ? `${m.piece.color}:shelter` : `${m.piece.color}#${m.piece.pieceIndex}`,
      m.kind,
      m.amount,
      m.diceSource,
      m.resultingTrackPosition,
      m.resultingCorridorPosition,
    ].join('|')
  const first = key(moves[0])
  return moves.every((m) => key(m) === first) ? moves[0] : null
}
