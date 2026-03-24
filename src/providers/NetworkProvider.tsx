import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import * as Network from "expo-network";
import { syncAll, SyncStatus } from "../lib/sync-engine";
import { getPendingQueueCount } from "../lib/offline-db";

interface NetworkContextType {
  isConnected: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  triggerSync: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  syncStatus: "synced",
  pendingCount: 0,
  triggerSync: async () => {},
});

const SYNC_INTERVAL = 30_000; // 30 seconds

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [pendingCount, setPendingCount] = useState(0);
  const syncInterval = useRef<ReturnType<typeof setInterval>>(undefined);

  const checkConnection = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setIsConnected(state.isConnected ?? true);
      return state.isConnected ?? true;
    } catch {
      return true; // Assume connected on error
    }
  }, []);

  const triggerSync = useCallback(async () => {
    const connected = await checkConnection();
    const count = await getPendingQueueCount();
    setPendingCount(count);

    if (!connected || count === 0) {
      if (count === 0) setSyncStatus("synced");
      return;
    }

    setSyncStatus("pending");
    const result = await syncAll();
    setSyncStatus(result);
    const newCount = await getPendingQueueCount();
    setPendingCount(newCount);
  }, [checkConnection]);

  useEffect(() => {
    checkConnection();
    triggerSync();

    syncInterval.current = setInterval(triggerSync, SYNC_INTERVAL);

    return () => {
      if (syncInterval.current) clearInterval(syncInterval.current);
    };
  }, [checkConnection, triggerSync]);

  return (
    <NetworkContext.Provider value={{ isConnected, syncStatus, pendingCount, triggerSync }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
