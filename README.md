# GreenNote — Green Corridor Management System

## Architecture

```
Frontend (React + Vite)          Backend (Node.js + Express)
┌─────────────────────┐          ┌─────────────────────────────┐
│ NavigationView      │◄──WS────►│ corridorSocket.js           │
│ LiveMonitoring      │          │   ambulance:gpsUpdate       │
│ LiveCorridorMap     │          │   corridor:update broadcast  │
│ MapContainer        │          │                             │
│ WebSocketContext    │          │ movementEngine.js           │
│                     │          │   → deviation detection     │
│                     │          │   → OSRM reroute            │
│                     │          │   → ETA calculation         │
│                     │          │                             │
│                     │◄─REST───►│ corridor.controller.js      │
│                     │          │ route.controller.js         │
│                     │          │                             │
│                     │          │ Algorithms:                 │
│                     │          │   osrmService.js            │
│                     │          │   emergencyCostEngine.js    │
│                     │          │   etaCalculator.js          │
│                     │          │   geocodingService.js       │
│                     │          │   signalScheduler.js        │
│                     │          │   mlPredictor.js            │
└─────────────────────┘          └─────────────────────────────┘
```

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Backend
```bash
cd Green/backend
npm install
# Create .env file
echo "PORT=5000
MONGO_URI=mongodb://localhost:27017/greennote
JWT_SECRET=your-secret-key
NODE_ENV=development
FRONTEND_URL=http://localhost:5173" > .env

npm run dev
```

### Frontend
```bash
cd Green/frontend
npm install
# Create .env file
echo "VITE_API_BASE_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5000" > .env

npm run dev
```

## Deploying to Render

### Backend (Web Service)
1. Connect your repo to Render
2. Set build command: `npm install`
3. Set start command: `node src/server.js`
4. Add environment variables:
   - `MONGO_URI` — your MongoDB Atlas URI
   - `JWT_SECRET` — your secret key
   - `NODE_ENV` — `production`
   - `FRONTEND_URL` — your deployed frontend URL (e.g., `https://greennote.onrender.com`)

### Frontend (Static Site)
1. Set build command: `npm run build`
2. Set publish directory: `dist`
3. Add environment variables:
   - `VITE_API_BASE_URL` — `https://your-backend.onrender.com/api`
   - `VITE_WS_URL` — `https://your-backend.onrender.com`

> **Note:** WebSocket on Render uses both `websocket` and `polling` transports. CORS is configured to auto-accept any `.onrender.com` subdomain.

## Key Data Flow

### GPS → ETA Pipeline
```
Ambulance GPS (every 2s)
    → ambulance:gpsUpdate event
    → corridorSocket.js → movementEngine.processGPSUpdate()
        1. Save GPS log to MongoDB
        2. Check deviation (> 50m from route?)
           Yes → OSRM reroute → emergencyCostEngine → new best route
           No  → find signals on route
        3. calculateLiveETA():
           - Find nearest waypoint on polyline
           - Sum remaining distance along polyline
           - baseTravelTime = remainingDist / speed
           - signalDelay = redSignalsAhead × SIGNAL_DELAY[criticality]
           - mlBias = federatedModel.biases[timeBucket]
           - ETA = baseTravelTime + signalDelay + mlBias
        4. Signal clearance (clear RED → GREEN if ambulance within range)
    → corridor:update broadcast to ALL roles
        { position, route, signals, eta, etaFormatted, criticality }
```

### OSRM Route Selection
```
fetchRoutes(source, dest)
    → OSRM API (alternatives=true, overview=full, geometries=geojson)
    → For each candidate route:
        EmergencyCost = baseDuration
                      + congestionPenalty  (0/+15%/+35%)
                      + signalPenalty      (RED signals × delay/criticality)
                      + instabilityPenalty (0/+8%/+20%)
                      + federatedBias      (ML learned time-of-day bias)
    → Sort by EmergencyCost ascending
    → Return lowest cost route
```

## Socket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `ambulance:gpsUpdate` | Client → Server | `{ corridorId, lat, lng, accuracy, speed, heading }` |
| `send_gps` (legacy) | Client → Server | `{ corridorId, position: { lat, lng, ... } }` |
| `corridor:update` | Server → All | `{ corridorId, position, route, signals, eta, etaFormatted, criticality, rerouted, demoMode }` |
| `gps_update` (legacy) | Server → All | `{ corridorId, position, eta, etaFormatted }` |
| `signal_cleared` | Server → All | `{ signalId, name, state, location }` |
| `route_updated` | Server → Corridor | `{ corridorId, reason, newETA }` |

## Demo Mode

Set `NODE_ENV=demo` in backend .env to use interpolated demo routes instead of OSRM. The demo routes are generated dynamically between actual source/destination coordinates with realistic curves.

If OSRM API is unreachable, the system automatically falls back to demo routes.
