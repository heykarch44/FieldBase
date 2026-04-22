import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";

export interface GeofencePermissionState {
  foreground: boolean;
  background: boolean;
  loading: boolean;
  requestPermissions: () => Promise<{ foreground: boolean; background: boolean }>;
  refresh: () => Promise<void>;
}

export function useGeofencePermissions(): GeofencePermissionState {
  const [foreground, setForeground] = useState(false);
  const [background, setBackground] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [fg, bg] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
    ]);
    setForeground(fg.granted);
    setBackground(bg.granted);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestPermissions = useCallback(async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    setForeground(fg.granted);
    if (!fg.granted) {
      setBackground(false);
      return { foreground: false, background: false };
    }
    const bg = await Location.requestBackgroundPermissionsAsync();
    setBackground(bg.granted);
    return { foreground: fg.granted, background: bg.granted };
  }, []);

  return {
    foreground,
    background,
    loading,
    requestPermissions,
    refresh,
  };
}
