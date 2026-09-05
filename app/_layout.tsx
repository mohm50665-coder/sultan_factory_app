import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, View, Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "@/lib/trpc";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LanguageProvider } from "@/lib/language-context";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

// الشاشات التي لا تتطلب تسجيل دخول
const AUTH_SCREENS = ["login", "register", "forgot-password"];

// Error Boundary to prevent white screen crash
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error("App Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
            حدث خطأ
          </Text>
          <Text style={{ fontSize: 14, color: "#666", textAlign: "center" }}>
            {this.state.error?.message || "خطأ غير معروف"}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Navigation component that uses useAuth
function NavigationContent() {
  const { isSignedIn, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const currentSegment = segments[0] as string;
    const isAuthScreen = AUTH_SCREENS.includes(currentSegment);
    const isAdminAddingUser = currentSegment === "register" && user?.role === "admin";

    if (isSignedIn && isAuthScreen && !isAdminAddingUser) {
      router.replace("/(tabs)");
    } else if (!isSignedIn && !isAuthScreen && currentSegment !== "oauth") {
      router.replace("/login");
    }
  }, [isSignedIn, segments, isLoading, user?.role]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="register" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="forgot-password" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="oauth/callback" />
      <Stack.Screen name="manufacturing" />
      <Stack.Screen name="manufacturing-stage" />
      <Stack.Screen name="product-tracking" />
      <Stack.Screen name="daily-summary" />
      <Stack.Screen name="production" />
      <Stack.Screen name="production-totals" />
      <Stack.Screen name="sales" />
      <Stack.Screen name="collection" />
      <Stack.Screen name="warehouse" />
      <Stack.Screen name="warehouse-finished" />
      <Stack.Screen name="warehouse-raw" />
      <Stack.Screen name="warehouse-out" />
      <Stack.Screen name="maintenance" />
      <Stack.Screen name="maintenance-section" />
      <Stack.Screen name="administrative" />
      <Stack.Screen name="financial" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="monthly-reports" />
      <Stack.Screen name="notifications-center" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="export-data" />
      <Stack.Screen name="search" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="admin-dashboard" />
      <Stack.Screen name="admin-settings" />
      <Stack.Screen name="dashboard-analytics" />
      <Stack.Screen name="role-management" />
      <Stack.Screen name="users-management" />
      <Stack.Screen name="activity-log" />
      <Stack.Screen name="activity-log-viewer" />
      <Stack.Screen name="product-cost-calculator" />
      <Stack.Screen name="production-export" />
      <Stack.Screen name="waste-alerts" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="in-app-notifications" />
      <Stack.Screen name="reports-analytics" />
      <Stack.Screen name="global-search" />
      <Stack.Screen name="section-reports" />
      <Stack.Screen name="employee-performance" />
      <Stack.Screen name="backup-restore" />
      <Stack.Screen name="machines-comparison" />
      <Stack.Screen name="share-reports" />
      <Stack.Screen name="production-costs" />
      <Stack.Screen name="cost-comparison-report" />
      <Stack.Screen name="board-representative" />
      <Stack.Screen name="board-representative-dashboard" />
      <Stack.Screen name="admin-control-panel" />
      <Stack.Screen name="admin-tools-permissions" />
      <Stack.Screen name="export-reports" />
      <Stack.Screen name="server-notifications" />
      <Stack.Screen name="advanced-analytics" />
      <Stack.Screen name="government-tenders" />
      <Stack.Screen name="meeting-request" />
      <Stack.Screen name="meeting-outputs" />
      <Stack.Screen name="admin-goals-kpis" />
      <Stack.Screen name="comprehensive-admin-panel" />
      <Stack.Screen name="board-monthly-report" />
      <Stack.Screen name="orders-visits" />
      <Stack.Screen name="production-requests" />
      <Stack.Screen name="custom-manufacturing" />
    </Stack>
  );
}

function RootLayoutContent() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? {
      insets: initialInsets,
      frame: initialFrame,
    };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));
  const [trpcClient] = useState(() => createTRPCClient());

  const content = (
    <View style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <NavigationContent />
              <StatusBar style="auto" />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </View>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        <SafeAreaFrameContext.Provider value={frame}>
          <SafeAreaInsetsContext.Provider value={insets}>
            {content}
          </SafeAreaInsetsContext.Provider>
        </SafeAreaFrameContext.Provider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider initialMetrics={providerInitialMetrics}>
      {content}
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <RootLayoutContent />
    </ErrorBoundary>
  );
}
