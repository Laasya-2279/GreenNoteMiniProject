import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const { token } = useAuth();
    const socketRef = useRef(null);

    useEffect(() => {
        // Resolve WebSocket URL for deployment:
        // Priority: VITE_WS_URL → derive from VITE_API_BASE_URL → window.location.origin → localhost
        let wsUrl = import.meta.env.VITE_WS_URL;
        if (!wsUrl) {
            const apiBase = import.meta.env.VITE_API_BASE_URL;
            if (apiBase) {
                // Derive WS URL from API base: "https://xxx.onrender.com/api" → "https://xxx.onrender.com"
                wsUrl = apiBase.replace(/\/api\/?$/, '');
            } else if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
                // On deployed frontend, try same-origin backend
                wsUrl = window.location.origin;
            } else {
                wsUrl = 'http://localhost:5000';
            }
        }
        console.log('[WS] Connecting to:', wsUrl);

        const newSocket = io(wsUrl, {
            auth: { token },
            // CRITICAL: Both transports for Render compatibility
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        newSocket.on('connect', () => {
            console.log('[WS] Connected:', newSocket.id);
            setConnected(true);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[WS] Disconnected:', reason);
            setConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('[WS] Connection error:', err.message);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [token]);

    // Join a corridor room to receive corridor:update broadcasts
    const joinCorridor = useCallback((corridorId) => {
        if (socketRef.current) {
            socketRef.current.emit('join_corridor', { corridorId });
        }
    }, []);

    const leaveCorridor = useCallback((corridorId) => {
        if (socketRef.current) {
            socketRef.current.emit('leave_corridor', { corridorId });
        }
    }, []);

    // NEW: Send GPS using the new event name (ambulance:gpsUpdate)
    const sendGPSUpdate = useCallback((data) => {
        if (socketRef.current) {
            socketRef.current.emit('ambulance:gpsUpdate', data);
        }
    }, []);

    // LEGACY: Send GPS using old event name (send_gps) — still works
    const sendGPS = useCallback((data) => {
        if (socketRef.current) {
            socketRef.current.emit('send_gps', data);
        }
    }, []);

    const overrideSignal = useCallback((data) => {
        if (socketRef.current) {
            socketRef.current.emit('signal_override', data);
        }
    }, []);

    return (
        <WebSocketContext.Provider value={{
            socket, connected,
            joinCorridor, leaveCorridor,
            sendGPSUpdate, sendGPS,
            overrideSignal
        }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) throw new Error('useWebSocket must be used within WebSocketProvider');
    return context;
};

export default WebSocketContext;
