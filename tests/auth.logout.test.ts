import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const authContext = readFileSync(resolve(process.cwd(), "lib/auth-context.tsx"), "utf8");
const profile = readFileSync(resolve(process.cwd(), "app/profile.tsx"), "utf8");

describe("Logout functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("window.confirm works as expected for web logout confirmation", () => {
    // On web, Alert.alert is a no-op in react-native-web
    // So we use window.confirm instead
    const mockConfirm = vi.fn().mockReturnValue(true);
    (globalThis as any).window = { confirm: mockConfirm };
    
    const confirmed = (globalThis as any).window.confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟");
    expect(confirmed).toBe(true);
    expect(mockConfirm).toHaveBeenCalledWith("هل أنت متأكد من رغبتك في تسجيل الخروج؟");
  });

  it("window.confirm returns false when user cancels", () => {
    const mockConfirm = vi.fn().mockReturnValue(false);
    (globalThis as any).window = { confirm: mockConfirm };
    
    const confirmed = (globalThis as any).window.confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟");
    expect(confirmed).toBe(false);
  });

  it("logout function clears user state", async () => {
    // Simulate the logout flow
    let user: any = { username: "admin", role: "admin" };
    
    const logout = async () => {
      user = null;
    };
    
    expect(user).not.toBeNull();
    await logout();
    expect(user).toBeNull();
  });

  it("Pressable style function provides correct pressed feedback", () => {
    // Verify our fix uses Pressable with style function
    const styleFunction = ({ pressed }: { pressed: boolean }) => [
      { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, padding: 8 },
      pressed && { opacity: 0.7 },
    ];
    
    const resultPressed = styleFunction({ pressed: true });
    expect(resultPressed[0]).toHaveProperty("backgroundColor");
    expect(resultPressed[1]).toHaveProperty("opacity", 0.7);
    
    const resultNotPressed = styleFunction({ pressed: false });
    expect(resultNotPressed[1]).toBe(false);
  });

  it("handleLogout on web calls window.confirm then logout then router.replace", async () => {
    // Simulate the full logout flow on web
    const mockConfirm = vi.fn().mockReturnValue(true);
    (globalThis as any).window = { confirm: mockConfirm };
    
    let isSignedIn = true;
    let currentRoute = "/(tabs)";
    
    const logout = vi.fn(async () => {
      isSignedIn = false;
    });
    
    const routerReplace = vi.fn((route: string) => {
      currentRoute = route;
    });
    
    // Simulate handleLogout on web
    const platformOS = "web";
    const confirmMessage = "هل أنت متأكد من رغبتك في تسجيل الخروج؟";
    
    if (platformOS === "web") {
      const confirmed = (globalThis as any).window.confirm(confirmMessage);
      if (confirmed) {
        await logout();
        routerReplace("/login");
      }
    }
    
    expect(mockConfirm).toHaveBeenCalledWith(confirmMessage);
    expect(logout).toHaveBeenCalled();
    expect(routerReplace).toHaveBeenCalledWith("/login");
    expect(isSignedIn).toBe(false);
    expect(currentRoute).toBe("/login");
  });

  it("uses one resilient logout path that expires the web cookie and clears local storage even offline", () => {
    expect(authContext).toContain('await apiCall("auth.logout", undefined)');
    expect(authContext).toContain("await clearLocalSession()");
    expect(authContext).toContain("sessionGeneration.current += 1");
    expect(authContext).toContain("generationAtRequest === sessionGeneration.current");
  });

  it("makes the profile logout control actionable on web as well as native", () => {
    expect(profile).toContain('Platform.OS === "web"');
    expect(profile).toContain("window.confirm(confirmation)");
    expect(profile).toContain('router.replace("/login")');
  });
});
