import * as React from 'react';
import { Box, Text } from '../../ink.js';

/**
 * ArgusMark — Altaris brand signature for the startup logo.
 * Replaces the upstream mascot with a 3-line monogram referencing the
 * original Argus motif (the watchful eye / hexagonal sentinel).
 *
 * Width: 9 cols, 3 rows — same footprint as the previous mascot, so the
 * surrounding LogoV2 layout (marginY, alignment) stays untouched.
 *
 * Pose prop is kept for API parity with previous callers; all poses render
 * the same static mark in the still version.
 */

export type ClawdPose = 'default' | 'arms-up' | 'look-left' | 'look-right';

type Props = { pose?: ClawdPose };

export function Clawd(_props: Props = {}) {
  return (
    <Box flexDirection="column" alignItems="center">
      <Text color="clawd_body">{'  ▗▄▄▄▖  '}</Text>
      <Text color="clawd_body">{'  ▐▣ ▣▌  '}</Text>
      <Text color="clawd_body">{'  ▝▀▀▀▘  '}</Text>
    </Box>
  );
}
