import "@/global.css";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
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

// Navigation component that uses useAuth
function NavigationContent() {
  const { isSignedIn, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const currentSegment = segments[0] as string;
    const inAuthGroup = currentSegment === "(tabs)";
    const isAuthScreen = AUTH_SCREENS.includes(currentSegment);

    if (isSignedIn && isAuthScreen) {
      // مسجل دخول ولكن في شاشة تسجيل دخول → انتقل للرئيسية
      router.replace("/(tabs)");
    } else if (!isSignedIn && !isAuthScreen && currentSegment !== "oauth") {
      // غير مسجل دخول وليس في شاشة تسجيل → انتقل لتسجيل الدخول
      router.replace("/login");
    }
    // في أي حالة أخرى (مسجل دخول ويتصفح شاشات التطبيق) → لا تفعل شيئاً
  }, [isSignedIn, segments, isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="register" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="forgot-password" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="oauth/callback" />
      <Stack.Screen name="manufacturing" />
      <Stack.Screen name="manufacturing-stage" />
      <Stack.Screen name="production" />
      <Stack.Screen name="sales" />
      <Stack.Screen name="collection" />
      <Stack.Screen name="warehouse" />
      <Stack.Screen name="warehouse-finished" />
      <Stack.Screen name="warehouse-raw" />
      <Stack.Screen name="warehouse-out" />
      <Stack.Screen name="maintenance" />
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
      <Stack.Screen name="dashboard-analytics" />
      <Stack.Screen name="role-management" />
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
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NavigationContent />
        <StatusBar style="auto" />
      </AuthProvider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <RootLayoutContent />;
}
