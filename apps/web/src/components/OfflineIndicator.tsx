import { WifiOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useConvex } from "convex/react";

import { cn } from "@/lib/utils";

type ConnectionState = "connected" | "disconnected" | "reconnecting";

export function OfflineIndicator() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");
  const convex = useConvex();

  useEffect(() => {
    const checkConnection = () => {
      if (!navigator.onLine) {
        setConnectionState("disconnected");
        return;
      }

      const client = convex as unknown as { connectionState?: () => { isWebSocketConnected: boolean } };
      if (client.connectionState) {
        const state = client.connectionState();
        if (state.isWebSocketConnected) {
          setConnectionState("connected");
        } else {
          setConnectionState("reconnecting");
        }
      } else {
        setConnectionState(navigator.onLine ? "connected" : "disconnected");
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2000);

    const handleOnline = () => setConnectionState("reconnecting");
    const handleOffline = () => setConnectionState("disconnected");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [convex]);

  if (connectionState === "connected") {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 rounded-full px-4 py-2 shadow-lg",
        connectionState === "disconnected" && "bg-red-500 text-white",
        connectionState === "reconnecting" && "bg-yellow-500 text-black"
      )}
    >
      {connectionState === "disconnected" && (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">You are offline</span>
        </>
      )}
      {connectionState === "reconnecting" && (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Reconnecting...</span>
        </>
      )}
    </div>
  );
}
