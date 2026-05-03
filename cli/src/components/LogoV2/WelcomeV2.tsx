import React from 'react';
import { Box, Text } from 'src/ink.js';

/**
 *  WelcomeV2 — Altaris brand welcome screen.
 *
 *  Upstream (Claude Code) version embedded a giant "C" letter ASCII art and a
 *  pig mascot. Replaced wholesale with the Argus monogram (the watchful-eye
 *  sentinel) + clean tagline. Same component name + props so callers
 *  (cli/handlers/util.tsx, Onboarding.tsx) keep working unchanged.
 */
export function WelcomeV2() {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text>
        <Text color="claude" bold>{"Welcome to Altaris"}</Text>
        <Text dimColor>{"  v"}{MACRO.DISPLAY_VERSION ?? MACRO.VERSION}</Text>
      </Text>
      <Text dimColor>
        {"┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"}
      </Text>

      {/* ArgusMark — watchful-eye sentinel monogram */}
      <Box flexDirection="column" alignItems="center" marginY={1}>
        <Text color="clawd_body">{'    ▗▄▄▄▄▄▖    '}</Text>
        <Text color="clawd_body">{'   ▐  ▣ ▣  ▌   '}</Text>
        <Text color="clawd_body">{'    ▝▀▀▀▀▀▘    '}</Text>
        <Text dimColor>{' Kurumsal Agentic AI Terminal '}</Text>
      </Box>

      <Text dimColor>
        {"┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"}
      </Text>
      <Text>
        <Text color="claude">{"Hadi başlayalım."}</Text>
        <Text dimColor>{"  /help · komutlar"}</Text>
      </Text>
    </Box>
  );
}

/**
 *  Apple Terminal: simpler render (24-bit color sometimes flaky). Same content,
 *  just inline.
 */
export function AppleTerminalWelcomeV2({ welcomeMessage }: { theme: string; welcomeMessage: string }) {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text>
        <Text color="claude" bold>{welcomeMessage}</Text>
        <Text dimColor>{"  v"}{MACRO.DISPLAY_VERSION ?? MACRO.VERSION}</Text>
      </Text>
      <Box flexDirection="column" alignItems="center" marginY={1}>
        <Text>{'  ▗▄▄▄▄▄▖  '}</Text>
        <Text>{' ▐  ▣ ▣  ▌ '}</Text>
        <Text>{'  ▝▀▀▀▀▀▘  '}</Text>
        <Text dimColor>{' Argus · Altaris '}</Text>
      </Box>
      <Text dimColor>{"Hadi başlayalım. /help — komutlar"}</Text>
    </Box>
  );
}
