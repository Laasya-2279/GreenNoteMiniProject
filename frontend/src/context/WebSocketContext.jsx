import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const { token } = useAuth();
    const socketRef = useRef(null);

    useEffect(() => {
        const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

        const newSocket = io(wsUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        newSocket.on('connect', () => {
            console.log('WebSocket connected');
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            setConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('WebSocket error:', err.message);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [token]);

    const joinCorridor = (corridorId) => {
        if (socketRef.current) {
            socketRef.current.emit('join_corridor', { corridorId });
        }
    };

    const leaveCorridor = (corridorId) => {
        if (socketRef.current) {
            socketRef.current.emit('leave_corridor', { corridorId });
        }
    };

    const sendGPS = (data) => {
        if (socketRef.current) {
            socketRef.current.emit('send_gps', data);
        }
    };

    const overrideSignal = (data) => {
        if (socketRef.current) {
            socketRef.current.emit('signal_override', data);
        }
    };

    return (
        <WebSocketContext.Provider value={{
            socket, connected,
            joinCorridor, leaveCorridor, sendGPS, overrideSignal
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
