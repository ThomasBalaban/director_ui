# secrets/

Local-only secret files. **Everything in this folder is gitignored.**

The launcher (`launcher.py`) loads every `*.env` file in this directory at
startup and forwards the variables into the environment of every child
service it spawns.

## Files

| File         | Variables                                    | Consumed by      |
|--------------|----------------------------------------------|------------------|
| `twitch.env` | `TWITCH_APP_ID`, `TWITCH_APP_SECRET`         | `twitch_service` |

## Adding a new secret

1. Drop a new `*.env` file in this folder.
2. Use `KEY=value` syntax (no quotes needed unless the value contains spaces).
3. The variables are available in every managed service via `os.environ`.

## Rotating credentials

Twitch app credentials are managed at <https://dev.twitch.tv/console/apps>.
