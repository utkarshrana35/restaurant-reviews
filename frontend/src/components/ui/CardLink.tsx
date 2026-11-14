'use client';

import CardActionArea from '@mui/material/CardActionArea';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface CardLinkProps {
  href: string;
  children: ReactNode;
}

/** Makes a card's content one link that navigates client-side, with the card's hover effect. */
export default function CardLink({ href, children }: CardLinkProps) {
  return (
    <CardActionArea
      component={Link}
      href={href}
      sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
    >
      {children}
    </CardActionArea>
  );
}
