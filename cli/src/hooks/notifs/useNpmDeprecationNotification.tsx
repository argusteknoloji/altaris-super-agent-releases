/**
 *  Upstream Claude Code'tan kalma "altaris install" / npm geçiş banner'ı.
 *  Altaris standalone Bun binary olarak `curl -fsSL altaris.run/install | sh`
 *  ile dağıtılıyor — npm/install komutu yok. Banner kullanıcıyı yanlış
 *  yönlendiren ölü bir link gösteriyordu (Gitlawb/altaris). Tamamen kapatıldı.
 */
import { useStartupNotification } from './useStartupNotification.js';
export function useNpmDeprecationNotification() {
  useStartupNotification(async () => null);
}
