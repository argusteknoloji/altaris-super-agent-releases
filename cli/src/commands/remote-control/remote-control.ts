import type { LocalCommandCall } from '../../types/command.js'
import {
  startRemoteControl,
  stopRemoteControl,
  isRemoteControlActive,
} from '../../argus/remoteControl.js'

export const call: LocalCommandCall = async (args, _context) => {
  const sub = (args ?? '').trim().toLowerCase()
  const active = isRemoteControlActive()

  if (sub === 'status') {
    return { type: 'text', value: active ? 'Remote Control: yayında ✓' : 'Remote Control: kapalı' }
  }

  let target: 'on' | 'off'
  if (sub === 'on' || sub === 'start') target = 'on'
  else if (sub === 'off' || sub === 'stop') target = 'off'
  else target = active ? 'off' : 'on'   // toggle

  if (target === 'on') {
    if (active) return { type: 'text', value: 'Remote Control zaten açık.' }
    await startRemoteControl()
    return { type: 'text', value: 'Remote Control açıldı. Web → /remote-control sayfasından izle.' }
  } else {
    if (!active) return { type: 'text', value: 'Remote Control zaten kapalı.' }
    await stopRemoteControl()
    return { type: 'text', value: 'Remote Control kapatıldı.' }
  }
}
