# antigravity-quota

CLI to check Antigravity model quota via Google Cloud API or a local IDE connection.

## Features

- Sign in/out with Google accounts
- Show current authentication status
- Fetch quota per account or for all accounts
- Output as table or JSON
- Support 3 modes: `auto`, `local`, `google`

## Requirements

- Node.js 18+ (20+ recommended)
- npm

## Install (from source)

```bash
npm install
npm run build
npm link
```

After linking, you can run `antigravity-quota` from anywhere.

## Quick start

```bash
antigravity-quota login
antigravity-quota status
antigravity-quota quota
```

## Commands

```bash
antigravity-quota login [--no-browser] [-p, --port <port>]
antigravity-quota logout [email]
antigravity-quota status [--all] [-a, --account <email>]
antigravity-quota quota [--json] [--all] [-a, --account <email>] [--refresh] [-m, --method <auto|local|google>]
```

## Notes on `quota` method

- `auto`: try `local` first, fall back to `google`
- `local`: read quota from Antigravity running in your IDE (VSCode, etc.)
- `google`: call Google Cloud API (requires login)

## Config storage

Credentials and cache are stored at:

- Windows: `%APPDATA%/antigravity-quota`
- macOS: `~/Library/Application Support/antigravity-quota`
- Linux: `~/.config/antigravity-quota` (hoặc `$XDG_CONFIG_HOME`)

## Development

```bash
npm run dev
npm run lint
npm run typecheck
npm test
```

## Debug

Add `--debug` to see detailed logs:

```bash
antigravity-quota quota --debug
```
