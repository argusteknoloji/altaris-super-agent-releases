/**
 * /create-vault — interactive altaris içinden hızlıca yeni bir Argus vault
 * yarat. Argümanlar:
 *
 *   /create-vault <slug>                 → yarat (görünür ad = slug)
 *   /create-vault <slug> "Görünür Ad"    → yarat
 *   /create-vault <slug> --no-sync       → lokal mirror'lama
 */
import type { Command } from '../../commands.js'

const createVault = {
  type: 'local',
  name: 'create-vault',
  description: 'Argus vault oluştur (server scaffold + DB + lokal mirror)',
  aliases: ['vault-new'],
  supportsNonInteractive: false,
  load: () => import('./create-vault.js'),
} satisfies Command

export default createVault
