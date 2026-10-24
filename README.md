# AI Rank — frontend and web proxy

Private application source snapshot. **Do not make this repository public.**
No deployment is performed by this transfer.

## Contents

- `artifacts/airank/`: complete React frontend, including overview graphs,
  English/Finnish UI, Content Studio, assets and tests.
- `artifacts/api-server/`: secure same-origin Express proxy and tests.
- `lib/`: shared clients, schemas and API contracts.
- `artifacts/mockup-sandbox/`: existing design sandbox source.
- `services/`: older local backend references; do not deploy over the current API.
- `backend-reference/`: sanitised source of the pinned deployed GitHub backend.
- `docs/lovable-migration/`: detailed Lovable prompt, connections, validation and
  cutover instructions.
- `inventory/`: source revision, file hashes, exclusions, environment names and
  transfer scan report.

Start with [the migration guide](docs/lovable-migration/START-HERE.md).
The [master Lovable prompt](docs/lovable-migration/LOVABLE-MASTER-PROMPT.md)
preserves the real application instead of asking for a visual reconstruction.

## Local verification

Node 24 and pnpm 10.26.1:

```sh
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install --frozen-lockfile
pnpm run test:release
pnpm run build:release
```

The browser harness is documented in
`artifacts/airank/test/scripts/README.md`. It uses isolated synthetic fixtures,
not production customer data or a login bypass.

## Integration boundary

Keep relative browser API calls and the security-preserving BFF. Existing Bunny
services/database remain in place. Static hosting alone cannot run the Express
proxy. Changing the frontend host requires explicit proxy hosting, approved
origins/OAuth callbacks and server-only secrets; source transfer does not perform
those changes.

Actual credentials, sessions, customer data, database dumps, installed dependencies,
generated app output and previous Git history are intentionally excluded.
Existing provider/data-quality gaps remain documented, not silently fixed.
