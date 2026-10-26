import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animationEndsWithCaptureFlight, CaptureFlightHoldTracker } from '../src/hooks/captureFlightHold'

// See CaptureFlightHoldTracker's own doc comment (src/hooks/captureFlightHold.ts) - the plain
// timer class useTurnManager.ts's own captureFlightPending state is built on, pulled out
// specifically so this behavior is directly testable without a React hook-testing harness.
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CaptureFlightHoldTracker', () => {
  it('reports pending immediately on trigger, then clears after holdMs', () => {
    const changes: boolean[] = []
    const tracker = new CaptureFlightHoldTracker((pending) => changes.push(pending), 300)

    tracker.trigger()
    expect(changes).toEqual([true])

    vi.advanceTimersByTime(299)
    expect(changes).toEqual([true])

    vi.advanceTimersByTime(1)
    expect(changes).toEqual([true, false])
  })

  it('retriggering restarts the clock instead of clearing on the first hold\'s original deadline', () => {
    const changes: boolean[] = []
    const tracker = new CaptureFlightHoldTracker((pending) => changes.push(pending), 300)

    tracker.trigger() // e.g. a capturing move's own hop finishes
    vi.advanceTimersByTime(200)
    tracker.trigger() // a second capture shortly after (a reward chain, a double's own bonus die)
    expect(changes).toEqual([true, true])

    // The first trigger's own 300ms deadline (at t=300) passes with no clear - the second
    // trigger's own clock (now running until t=500) is the one that governs.
    vi.advanceTimersByTime(100) // t=300
    expect(changes).toEqual([true, true])

    vi.advanceTimersByTime(199) // t=499
    expect(changes).toEqual([true, true])

    vi.advanceTimersByTime(1) // t=500
    expect(changes).toEqual([true, true, false])
  })

  it('dispose cancels a running hold with no trailing onChange(false) call', () => {
    const changes: boolean[] = []
    const tracker = new CaptureFlightHoldTracker((pending) => changes.push(pending), 300)

    tracker.trigger()
    tracker.dispose()

    vi.advanceTimersByTime(1000)
    expect(changes).toEqual([true])
  })
})

// useTurnManager.ts's clearMoveAnimation/clearParkillerAnimation start the capture-flight hold in
// the same call that clears the animation, gated on this - so the one-render "everything settled"
// gap that used to swallow the Parki-capture toast can't reopen for any of these capture shapes.
describe('animationEndsWithCaptureFlight', () => {
  it('is true for a pawn move that captured, its simultaneous second exit capturing, or a Parkiller hop that captured', () => {
    expect(animationEndsWithCaptureFlight({ capturedPiece: {} })).toBe(true)
    expect(animationEndsWithCaptureFlight({ capturedPiece: null, simultaneousWith: { capturedPiece: {} } })).toBe(true)
    expect(animationEndsWithCaptureFlight({ capturedPawn: {} })).toBe(true)
  })

  it('is false when nothing was captured, or there is no animation at all', () => {
    expect(animationEndsWithCaptureFlight({ capturedPiece: null })).toBe(false)
    expect(animationEndsWithCaptureFlight({ capturedPawn: null })).toBe(false)
    expect(animationEndsWithCaptureFlight({ capturedPiece: null, simultaneousWith: { capturedPiece: null } })).toBe(false)
    expect(animationEndsWithCaptureFlight(null)).toBe(false)
  })
})
