import * as React from 'react';
import { useEffect, useState } from 'react';
import { Box, Text } from '../../ink.js';

/**
 * AnimatedArgusMark — gentle 2-frame blink of the Altaris signature
 * (eyes open ▣▣ → closed ▭▭). Runs only in fullscreen-friendly TTYs;
 * the still <Clawd /> is used otherwise.
 */

export function AnimatedClawd() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    const id = setInterval(() => {
      if (!alive) return;
      setOpen(false);
      setTimeout(() => { if (alive) setOpen(true); }, 140);
    }, 3400);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const eyes = open ? '▣ ▣' : '▭ ▭';

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color="clawd_body">{'  ▗▄▄▄▖  '}</Text>
      <Text color="clawd_body">{`  ▐${eyes}▌  `}</Text>
      <Text color="clawd_body">{'  ▝▀▀▀▘  '}</Text>
    </Box>
  );
}
