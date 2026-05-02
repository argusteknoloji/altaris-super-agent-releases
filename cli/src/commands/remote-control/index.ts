/**
 * /remote-control — toggle Argus Remote Control yayını mevcut interactive
 * altaris oturumunda. Lokal Ink session'unu broker üzerinden web viewer'lara
 * fan-out eder; argümanlar:
 *
 *   /remote-control            → toggle (açıksa kapat, kapalıysa aç)
 *   /remote-control on         → açıkça başlat
 *   /remote-control off        → açıkça durdur
 *   /remote-control status     → durumu yazdır
 */
import type { Command } from '../../commands.js'

const remoteControl = {
  type: 'local',
  name: 'remote-control',
  description: 'Argus Remote Control yayınını aç / kapa (web viewer\'lar takeover ile katılabilir)',
  aliases: ['rc'],
  supportsNonInteractive: false,
  load: () => import('./remote-control.js'),
} satisfies Command

export default remoteControl
