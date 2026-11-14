'use client';

import MuiLink from '@mui/material/Link';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** An inline text link that navigates client-side. */
export default function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <MuiLink component={Link} href={href} underline="hover" sx={{ fontWeight: 600 }}>
      {children}
    </MuiLink>
  );
}
