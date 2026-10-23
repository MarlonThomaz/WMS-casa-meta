import { useState, useEffect } from 'react';
import { Location, LocationWithOccupancy, getLocations, getLocationByCode, getLocationsWithOccupancy } from '../services/locations';

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLocations();
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar localizações');
      console.error('Erro ao carregar localizações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const refresh = async () => {
    await loadLocations();
  };

  return {
    locations,
    loading,
    error,
    refresh,
  };
}

export function useLocationsWithOccupancy() {
  const [locations, setLocations] = useState<LocationWithOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLocationsWithOccupancy();
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar localizações');
      console.error('Erro ao carregar localizações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const refresh = async () => {
    await loadLocations();
  };

  return {
    locations,
    loading,
    error,
    refresh,
  };
}

export function useLocationByCode(code: string | null) {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setLocation(null);
      return;
    }

    const loadLocation = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getLocationByCode(code);
        setLocation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar localização');
        console.error('Erro ao carregar localização:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLocation();
  }, [code]);

  return { location, loading, error };
}
