// Runs on the files staged for a commit (see .husky/pre-commit), so a commit only ever contains
// code that ESLint has fixed what it can in and that Prettier has formatted. Any fix is added to
// the commit automatically. A problem ESLint cannot fix stops the commit and is shown.
export default {
  // ESLint first, then Prettier, so the formatting has the last word.
  // --no-warn-ignored: a staged file under an ignored path (dist, .next) is skipped quietly.
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix --no-warn-ignored', 'prettier --write'],
  // --ignore-unknown: Prettier skips file types it has no parser for.
  '*.{json,md,yml,yaml,css,html}': 'prettier --write --ignore-unknown',
};
