/** Card grid for restaurant lists: one column on phones, up to three on wide screens. */
export const RESTAURANT_GRID = {
  display: 'grid',
  gap: 3,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
};
