# Contributing

The contribution this repository most wants is a container for a library it
does not measure yet, or a correction to a cell you can show is inaccurate.

- Adding a library: [docs/adding-an-adapter.md](docs/adding-an-adapter.md) is
  the walkthrough, and [docs/container-protocol.md](docs/container-protocol.md)
  is the contract your container implements. Any language works.
- Disputing a measurement: the same walkthrough has the procedure. Start at the
  stored raw output for the cell, by case id, in `report/libraries/`.
- Everything else: [AGENTS.md](AGENTS.md) holds the conventions, most of which
  exist to keep library-specific influence out of the measurement. Corpus
  changes need citations; the two gates are `pnpm check` (seconds) and
  `pnpm check:containers` (Docker, minutes).
