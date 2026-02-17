# Director UI

Angular-based dashboard for the Nami Director Engine.

## Architecture

This is a standalone Angular application that connects to the Director Engine backend via:
- **Socket.IO** - Real-time event streaming
- **REST API** - HTTP endpoints for data fetching

## Prerequisites

- Node.js 18+
- npm 9+
- Director Engine running on `localhost:8002`

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The UI will be available at `http://localhost:4200`

## Configuration

Edit `src/environments/environment.ts` to change the backend URL:

```typescript
export const environment = {
  production: false,
  directorEngineUrl: 'http://localhost:8002',
  socketUrl: 'http://localhost:8002'
};
```

## Project Structure

```
src/
├── app/
│   ├── components/          # UI Components
│   │   ├── dashboard/       # Main orchestrator
│   │   ├── header/          # Top bar with controls
│   │   ├── directives-panel/
│   │   ├── summary-panel/
│   │   ├── interest-graph/  # Chart.js graph
│   │   ├── context-panel/   # Vision/Speech/Audio
│   │   ├── chat-panel/      # Twitch chat & Nami
│   │   ├── metrics-panel/   # Brain metrics
│   │   ├── user-panel/      # Active user info
│   │   ├── memory-panel/    # Memory display
│   │   └── context-drawer/  # Prompt details
│   ├── models/              # TypeScript interfaces
│   └── services/            # Director Service (Socket.IO)
├── environments/            # Environment configs
└── styles.css               # Global styles
```

## Key Features

- **Real-time updates** via Socket.IO
- **Reactive state management** using RxJS BehaviorSubjects
- **Standalone components** (Angular 17+)
- **Responsive grid layout** for dashboard
- **Interactive charts** with Chart.js

## Development

```bash
# Run with hot reload
npm start

# Build for production
npm run build
```

## Backend Communication

The `DirectorService` handles all backend communication:

```typescript
// Subscribe to real-time updates
this.directorService.directorState$.subscribe(state => {
  // Handle state updates
});

// Send commands
this.directorService.setManualContext('Playing Phasmophobia');
this.directorService.setStreamer('peepingotter');
```
