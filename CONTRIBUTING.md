# Contributing to COROS Pulse

Thanks for your interest! This is a small open-source project and contributions are
welcome — bug fixes, new metrics, UI polish, docs.

## Getting set up

```bash
npm install
cp .env.example .env.local   # fill in your COROS login
npm run dev                  # http://localhost:3000
```

See the [README](README.md) for the full setup walkthrough, and **[CLAUDE.md](CLAUDE.md)**
for the non-obvious internals — COROS API quirks, the scoring model, and the coach
backends. Read CLAUDE.md before touching `lib/coros.ts` or `lib/metrics.ts`.

## Before you open a pull request

- **It typechecks:** `npx tsc --noEmit`
- **It builds:** `npm run build`
- **(If you touched the COROS client/scoring) it still pulls data:** `npm run coros:check`
- Keep one logical change per PR, with a clear description of what and why.

## Conventions

- **Web login only.** Do **not** add code paths that hit the COROS *mobile* API
  without an explicit, clearly-warned opt-in — the mobile login can log a user out
  of the COROS app on their phone. Sleep stages are the one exception and are gated
  behind `COROS_ENABLE_SLEEP` (default off).
- **Never commit credentials.** `.env.local` is git-ignored; run `git status` before
  every commit to be sure it isn't staged.
- Chart and series colors live in `lib/chartColors.ts` (Recharts can't read Tailwind
  classes); keep them in sync with `tailwind.config.ts`.
- Use the `.label` / `.nums` utility classes from `globals.css` rather than
  re-spelling the same Tailwind each time.

## Reporting bugs & ideas

Open an issue using one of the templates. For bugs, include your OS, Node version
(`node -v`), and the steps to reproduce.

## License

By contributing, you agree your contributions are licensed under the project's
[MIT License](LICENSE).
