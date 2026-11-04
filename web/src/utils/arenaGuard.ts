type ArenaLeaveGuard = () => boolean

let leaveGuard: ArenaLeaveGuard | null = null

export function setArenaLeaveGuard(guard: ArenaLeaveGuard | null): void {
  leaveGuard = guard
}

export function confirmArenaLeave(): boolean {
  return leaveGuard ? leaveGuard() : true
}
