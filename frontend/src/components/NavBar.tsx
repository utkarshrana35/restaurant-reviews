'use client';

import type { UserDto } from '@restaurant-reviews/common';
import Link from 'next/link';
import { useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  LinkButton,
  ListItemText,
  Menu,
  MenuItem,
  PageContainer,
  Stack,
  Toolbar,
  Typography,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useLogoutMutation } from '@/store/apiSlice';

// Both layouts are rendered and CSS shows one, so the server and the browser always agree.
const PHONE_ONLY = { display: { xs: 'flex', sm: 'none' } };
const WIDE_ONLY = { display: { xs: 'none', sm: 'flex' } };
const WIDE_ONLY_INLINE = { display: { xs: 'none', sm: 'inline-flex' } };

/** The bar at the top of every page, with links that depend on who is signed in. */
export default function NavBar() {
  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      <PageContainer>
        <Toolbar disableGutters sx={{ gap: 1 }}>
          <Typography
            component={Link}
            href="/"
            variant="h5"
            sx={{
              fontSize: { xs: '1.15rem', sm: '1.5rem' },
              fontWeight: 700,
              color: 'text.primary',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Restaurant Reviews
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <AccountMenu />
        </Toolbar>
      </PageContainer>
    </AppBar>
  );
}

function AccountMenu() {
  const { user, isKnown } = useAuth();
  const [logout, { isLoading: isSigningOut }] = useLogoutMutation();

  // Nothing until the session is known, so guests' links do not flash for signed-in users. The
  // same when it could not be checked: the visitor may well be signed in.
  if (!isKnown) return null;

  if (!user) {
    return (
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        <LinkButton href="/login" size="small">
          Sign in
        </LinkButton>
        {/* Too wide for a phone next to the title; the sign-in page links to registration. */}
        <LinkButton href="/register" variant="contained" size="small" sx={WIDE_ONLY_INLINE}>
          Register
        </LinkButton>
      </Stack>
    );
  }

  const signOut = async () => {
    await logout()
      .unwrap()
      .catch(() => undefined);
    // A full page load, not a client-side navigation: it discards everything held in memory for
    // this user, and the fresh page asks the server who (if anyone) is signed in.
    window.location.assign('/');
  };

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ ...WIDE_ONLY, alignItems: 'center' }}>
        {user.role === 'owner' && <LinkButton href="/owner/restaurants">My restaurants</LinkButton>}
        <LinkButton href="/account">{user.name}</LinkButton>
        <Button variant="outlined" loading={isSigningOut} onClick={signOut}>
          Sign out
        </Button>
      </Stack>
      <Box sx={PHONE_ONLY}>
        <PhoneMenu user={user} onSignOut={signOut} signingOut={isSigningOut} />
      </Box>
    </>
  );
}

interface PhoneMenuProps {
  user: UserDto;
  onSignOut: () => void;
  signingOut: boolean;
}

/** On phones the account links move into a menu opened from the user's initial. */
function PhoneMenu({ user, onSignOut, signingOut }: PhoneMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        aria-label={`Account menu for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
        size="small"
      >
        <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 16 }}>
          {user.name.trim().charAt(0).toUpperCase() || '?'}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <ListItemText
            primary={user.name}
            secondary={user.email}
            slotProps={{ primary: { sx: { overflowWrap: 'anywhere' } } }}
          />
        </MenuItem>
        <Divider />
        {user.role === 'owner' && (
          <MenuItem component={Link} href="/owner/restaurants" onClick={close}>
            My restaurants
          </MenuItem>
        )}
        <MenuItem component={Link} href="/account" onClick={close}>
          Your account
        </MenuItem>
        <MenuItem onClick={onSignOut} disabled={signingOut}>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
