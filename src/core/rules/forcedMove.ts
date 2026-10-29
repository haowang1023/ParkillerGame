import type { PlayerState } from '../gameFlow/playerState'
import type { MoveOption } from './moveOption'
import { isParkillerOnTrack } from './parchisRules'

// The move to play automatically when the player has no real choice, or null when they do.
// Requested directly, twice: "las jugadas obligatorias deberian de ser gestionadas por el juego,
// como por ejemplo salir con 5", then "If you dont have choise, the Machine play inmidiatly... The
// game has to be faster". One option is obviously forced, but exiting with a 5 offers one ExitYard
// per pawn still in the shelter - all identical, since shelter pawns are interchangeable - so the
// player was still being asked to pick one. Pieces already on the board keep their identity even
// when two share a square: one of them may have moved earlier this roll, which changes what landing
// on a Parkiller does (PK6), and a MoveOption doesn't carry that.
//
// Then, directly: "Cuando sale un 5 y hay peones en la casa y la salida está desocupada, debe salir
// el peón de manera automática" - even when the other die still leaves a choice for later. An
// ExitYard is only ever offered when the exit is obligatory for that die (PC2.1), so with the exit
// square empty there's nothing to weigh up first. With anything already on it (a pawn to join or
// capture, a Parki) the player still decides.
export function forcedMove(moves: readonly MoveOption[], players: readonly PlayerState[] = []): MoveOption | null {
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
  if (moves.every((m) => key(m) === first)) return moves[0]

  const exit = moves.find((m) => m.kind === 'ExitYard')
  if (exit && players.length > 0) {
    const square = exit.resultingTrackPosition
    const occupied = players.some(
      (p) => p.pieces.some((piece) => piece.state === 'OnTrack' && piece.trackPosition === square) || (isParkillerOnTrack(p.parkiller) && p.parkiller.trackPosition === square),
    )
    if (!occupied) return exit
  }
  return null
}
