import React, { useEffect } from 'react';
import { Box, Text } from '../ink.js';

/**
 * Altaris stub for the upstream OAuth onboarding flow.
 *
 * The original flow opened a browser to a hosted OAuth authorize URL — that
 * URL was rebranded mechanically to a domain that doesn't exist for Altaris.
 * The real Altaris sign-in is the Argus CLI extension `altaris login` (OAuth
 * Device Flow against the tenant's Keycloak), so we render a one-screen
 * pointer here and immediately resolve the parent flow so onboarding /
 * teleport / `/login` callers don't deadlock.
 *
 * Public types are preserved for caller compatibility.
 */

export type ConsoleOAuthFlowResult =
  | { type: 'oauth' }
  | { type: 'provider-setup'; message: string };

type Props = {
  onDone(result?: ConsoleOAuthFlowResult): void;
  startingMessage?: string;
  mode?: 'login' | 'setup-token';
  forceLoginMethod?: 'claudeai' | 'console';
};

export function ConsoleOAuthFlow({ onDone }: Props) {
  // Remote PTY (web terminal) içinde API tarafı access_token'ı env'e enjekte
  // ediyor — bu stub'ı ne göster ne de bekle. Aksi halde kullanıcı her oturumda
  // "bulut oturum açma kullanılmıyor" ekranını boşuna görüyor.
  const isRemote = process.env.ALTARIS_REMOTE === '1';

  useEffect(() => {
    const t = setTimeout(() => onDone(), isRemote ? 0 : 1800);
    return () => clearTimeout(t);
  }, [onDone, isRemote]);

  if (isRemote) return null;

  return (
    <Box flexDirection="column" gap={1} paddingX={1}>
      <Text bold>Altaris — bulut oturum açma kullanılmıyor</Text>
      <Text dimColor>
        Argus Identity Provider'a giriş için yeni bir terminalde:
      </Text>
      <Text color="yellow">  altaris login</Text>
      <Text dimColor>
        (OAuth 2.0 Device Authorization Grant → Keycloak)
      </Text>
      <Text dimColor>
        Provider yapılandırması için web panel:{' '}
        <Text color="cyan">http://localhost:3000/admin/providers</Text>
      </Text>
    </Box>
  );
}
