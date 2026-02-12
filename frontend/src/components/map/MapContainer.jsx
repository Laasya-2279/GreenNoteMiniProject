// MapContainer — Reusable shared map component for the GreenNote frontend
// Wraps LiveCorridorMap with optional route/corridor fetching
import { useState, useEffect } from 'react';
import LiveCorridorMap from '../LiveCorridorMap';
import { corridorAPI } from '../../services/api';

/**
 * MapContainer — Auto-loads corridor data and passes to LiveCorridorMap
 *
 * Props:
 *   - corridorId: string (required) — corridor to visualize
 *   - height: string — map height (default '500px')
 *   - autoLoad: bool — whether to fetch corridor details on mount (default true)
 */
const MapContainer = ({ corridorId, height = '500px', autoLoad = true }) => {
    const [corridor, setCorridor] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!corridorId || !autoLoad) return;

        const load = async () => {
            try {
                const res = await corridorAPI.getById(corridorId);
                setCorridor(res.data.corridor);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load corridor');
            }
        };
        load();
    }, [corridorId, autoLoad]);

    if (error) {
        return (
            <div style={{
                height, width: '100%', borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ef4444', fontSize: '14px'
            }}>
                ⚠️ {error}
            </div>
        );
    }

    return (
        <LiveCorridorMap
            corridorId={corridorId}
            height={height}
            sourceLabel={corridor?.sourceHospital?.name}
            destLabel={corridor?.destinationHospital?.name}
        />
    );
};

export default MapContainer;
