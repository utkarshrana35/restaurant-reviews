'use client';

import Button, { type ButtonProps } from '@mui/material/Button';
import Link from 'next/link';

// Only the styling props: the element rendered is an anchor, so button-element props do not apply.
type LinkButtonProps = Pick<
  ButtonProps,
  'variant' | 'color' | 'size' | 'fullWidth' | 'startIcon' | 'endIcon' | 'sx' | 'children'
> & { href: string };

/** A button that navigates client-side. Usable from server components. */
export default function LinkButton({ href, ...props }: LinkButtonProps) {
  return <Button component={Link} href={href} {...props} />;
}
