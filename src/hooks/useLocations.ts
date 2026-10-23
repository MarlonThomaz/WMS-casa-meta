import { useState, useEffect } from 'react';
import { getLocations, getLocationsWithOccupancy } from '../services/locations';
import { DBLocation, LocationWithOccupancy } from '../types';

export function useLocations() {
  const [locations, setLocations] = useState<DBLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { locations, loading, error, refresh: () => getLocations().then(setLocations) };
}

export function useLocationsWithOccupancy() {
  const [locations, setLocations] = useState<LocationWithOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLocationsWithOccupancy()
      .then(setLocations)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { locations, loading, error, refresh: () => getLocationsWithOccupancy().then(setLocations) };
}
