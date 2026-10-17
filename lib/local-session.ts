import AsyncStorage from "@react-native-async-storage/async-storage";

export const USER_STORAGE_KEY = "sultan_current_user";
export const SESSION_STORAGE_KEY = "sultan_session_id";

type StoredLocalUser = {
  id?: number | string | null;
  isActive?: number | boolean | null;
};

/**
 * Local employee sessions are authenticated by the database user id. Older
 * installations may contain the saved user profile but not the separate
 * session key, which made protected report calls fail after a refresh.
 *
 * This function repairs only that missing local key. It never invents an id:
 * the server remains the authority and rejects missing, inactive, or deleted
 * accounts on every protected request.
 */
export async function getLocalSessionId(): Promise<string | null> {
  const storedSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  const normalizedSession = String(storedSession || "").trim();
  if (/^[1-9]\d*$/.test(normalizedSession)) return normalizedSession;

  const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
  if (!storedUser) return null;

  try {
    const user = JSON.parse(storedUser) as StoredLocalUser;
    const userId = String(user?.id ?? "").trim();
    const isExplicitlyInactive = user?.isActive === 0 || user?.isActive === false;
    if (!isExplicitlyInactive && /^[1-9]\d*$/.test(userId)) {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, userId);
      return userId;
    }
  } catch {
    // Invalid stored data is treated as no session and is not sent to the API.
  }

  return null;
}

export async function persistLocalSessionForUser(user: StoredLocalUser | null | undefined): Promise<string | null> {
  const userId = String(user?.id ?? "").trim();
  const isExplicitlyInactive = user?.isActive === 0 || user?.isActive === false;
  if (isExplicitlyInactive || !/^[1-9]\d*$/.test(userId)) return null;
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, userId);
  return userId;
}

export async function clearLocalSession(): Promise<void> {
  await AsyncStorage.multiRemove([USER_STORAGE_KEY, SESSION_STORAGE_KEY]);
}
