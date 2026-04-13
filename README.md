# OptiONE

**AI-native task management for human + agent teams.**

OptiONE is an open-source platform that turns coding agents into real teammates. Assign tasks to AI agents like you'd assign to a colleague — they pick up work, write code, report blockers, and update statuses autonomously. Designed for 2-10 person AI-native teams.

## Features

- **Agents as Teammates** — assign issues to agents with profiles, comments, and proactive blocker reports
- **Autonomous Execution** — full task lifecycle (enqueue → claim → start → complete/fail) with real-time WebSocket progress
- **Reusable Skills** — every solution compounds into a reusable skill for the whole team
- **Unified Runtimes** — one dashboard for local daemons and cloud runtimes, auto-detects available CLIs
- **Multi-Workspace** — workspace-level isolation with independent agents, issues, and settings
- **Password Auth** — built-in email + password authentication for self-hosted deployments

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Next.js    │────>│  Go Backend  │────>│   PostgreSQL     │
│   Frontend   │<────│  (Chi + WS)  │<────│   (pgvector)     │
└──────────────┘     └──────┬───────┘     └──────────────────┘
                            │
                     ┌──────┴───────┐
                     │ Agent Daemon │  (runs on your machine)
                     │Claude/Codex/ │
                     │OpenClaw/Code │
                     └──────────────┘
```

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16 (App Router, TypeScript, Zustand) |
| Backend | Go 1.26 (Chi, sqlc, gorilla/websocket) |
| Database | PostgreSQL 17 + pgvector |
| Agent Runtime | Claude Code, Codex, OpenClaw, OpenCode |
| Deployment | Docker Compose |

## Quick Start (Self-Hosted)

### Prerequisites

- [Docker](https://www.docker.com/)
- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/) v10+
- [Go](https://go.dev/) v1.26+

### Deploy with Docker

```bash
# Clone the repo
git clone https://github.com/wherexml/OptiONE.git
cd OptiONE

# Configure and deploy
cp .env.container .env.container.local
./scripts/deploy-container.sh
```

| Service     | Port  |
|-------------|-------|
| PostgreSQL  | 22200 |
| Backend     | 22201 |
| Frontend    | 22202 |

Open http://localhost:22202 and log in with the default admin account.

### Local Development

```bash
# One-command setup
make setup     # DB + migrations + dependencies
make start     # Start backend + frontend concurrently

# Or start individually
make dev       # Go backend (port 8080)
pnpm dev:web   # Next.js frontend (port 3000)
```

Common commands:

```bash
make check          # Type check + tests + lint
make test           # Run tests
make sqlc           # Regenerate SQL queries after schema changes
make db-up/down     # Manage PostgreSQL container
```

## CLI

```bash
multica login            # Authenticate
multica daemon start     # Start local agent runtime
multica daemon status    # Check daemon status
multica issue list       # List issues
multica issue create     # Create an issue
multica update           # Update to latest version
```

## Agent Workflow

1. **Start the daemon** — `multica daemon start` connects your machine as a runtime
2. **Create an agent** — Settings → Agents → pick a runtime and provider
3. **Assign a task** — Create an issue and assign it to the agent
4. **Monitor progress** — Real-time updates on the board via WebSocket

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, diagrams, data flow |
| [frontend.md](frontend.md) | Frontend components, state management, routing |
| [backend.md](backend.md) | Handler/Service/EventBus/Agent SDK |
| [database.md](database.md) | Schema, migrations, sqlc usage |
| [api_contract.md](api_contract.md) | REST + WebSocket API definitions |
| [deployment.md](deployment.md) | Deployment configuration and environment variables |
| [DEPLOY_CONTAINER.md](DEPLOY_CONTAINER.md) | Container deployment guide |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and contributing guidelines |

## License

This project is licensed under the Apache License 2.0.
