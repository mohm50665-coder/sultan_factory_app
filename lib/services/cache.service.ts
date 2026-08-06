import AsyncStorage from "@react-native-async-storage/async-storage";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheService {
  private static instance: CacheService;
  private memoryCache: Map<string, CacheEntry<any>> = new Map();

  private constructor() {}

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * حفظ البيانات في الذاكرة والتخزين المحلي
   */
  async set<T>(key: string, data: T, ttlMinutes: number = 60): Promise<void> {
    const ttl = ttlMinutes * 60 * 1000; // تحويل الدقائق إلى ميلي ثانية
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    // حفظ في الذاكرة
    this.memoryCache.set(key, entry);

    // حفظ في التخزين المحلي
    try {
      await AsyncStorage.setItem(
        `cache_${key}`,
        JSON.stringify(entry)
      );
    } catch (error) {
      console.warn(`[Cache] Failed to save to AsyncStorage: ${key}`, error);
    }
  }

  /**
   * الحصول على البيانات من الذاكرة أو التخزين المحلي
   */
  async get<T>(key: string): Promise<T | null> {
    // البحث في الذاكرة أولاً
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.data as T;
    }

    // البحث في التخزين المحلي
    try {
      const stored = await AsyncStorage.getItem(`cache_${key}`);
      if (stored) {
        const entry: CacheEntry<T> = JSON.parse(stored);
        if (!this.isExpired(entry)) {
          // إعادة حفظ في الذاكرة
          this.memoryCache.set(key, entry);
          return entry.data;
        } else {
          // حذف البيانات المنتهية الصلاحية
          await this.remove(key);
        }
      }
    } catch (error) {
      console.warn(`[Cache] Failed to retrieve from AsyncStorage: ${key}`, error);
    }

    return null;
  }

  /**
   * حذف البيانات من الذاكرة والتخزين المحلي
   */
  async remove(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn(`[Cache] Failed to remove from AsyncStorage: ${key}`, error);
    }
  }

  /**
   * مسح جميع البيانات المخزنة مؤقتاً
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith("cache_"));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn("[Cache] Failed to clear cache", error);
    }
  }

  /**
   * التحقق من انتهاء صلاحية البيانات
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return now - entry.timestamp > entry.ttl;
  }

  /**
   * الحصول على إحصائيات الذاكرة
   */
  getMemoryStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys()),
    };
  }

  /**
   * تنظيف البيانات المنتهية الصلاحية
   */
  async cleanup(): Promise<void> {
    // تنظيف الذاكرة
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // تنظيف التخزين المحلي
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith("cache_"));

      for (const key of cacheKeys) {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const entry: CacheEntry<any> = JSON.parse(stored);
          if (this.isExpired(entry)) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.warn("[Cache] Failed to cleanup cache", error);
    }
  }
}

export const cacheService = CacheService.getInstance();
