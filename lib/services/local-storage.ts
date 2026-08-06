import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  PRODUCTION_DATA: "production_data",
  MANUFACTURING_DATA: "manufacturing_data",
  SALES_DATA: "sales_data",
  COLLECTION_DATA: "collection_data",
  WAREHOUSE_DATA: "warehouse_data",
  MAINTENANCE_DATA: "maintenance_data",
  ADMINISTRATIVE_DATA: "administrative_data",
  FINANCIAL_DATA: "financial_data",
  TASKS_DATA: "tasks_data",
};

export interface StorageData {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

class LocalStorageService {
  /**
   * حفظ بيانات في التخزين المحلي
   */
  async saveData(key: string, data: StorageData): Promise<void> {
    try {
      const existingData = await this.getAllData(key);
      const updatedData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };

      // إذا كانت البيانات موجودة، قم بتحديثها
      const index = existingData.findIndex((item) => item.id === data.id);
      if (index !== -1) {
        existingData[index] = updatedData;
      } else {
        existingData.push({
          ...updatedData,
          createdAt: new Date().toISOString(),
        });
      }

      await AsyncStorage.setItem(key, JSON.stringify(existingData));
    } catch (error) {
      console.error("Error saving data:", error);
      throw error;
    }
  }

  /**
   * الحصول على جميع البيانات المحفوظة
   */
  async getAllData(key: string): Promise<StorageData[]> {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error getting data:", error);
      return [];
    }
  }

  /**
   * الحصول على بيانات محددة برقم معرّف
   */
  async getData(key: string, id: string): Promise<StorageData | null> {
    try {
      const allData = await this.getAllData(key);
      return allData.find((item) => item.id === id) || null;
    } catch (error) {
      console.error("Error getting data:", error);
      return null;
    }
  }

  /**
   * حذف بيانات محددة
   */
  async deleteData(key: string, id: string): Promise<void> {
    try {
      const existingData = await this.getAllData(key);
      const filteredData = existingData.filter((item) => item.id !== id);
      await AsyncStorage.setItem(key, JSON.stringify(filteredData));
    } catch (error) {
      console.error("Error deleting data:", error);
      throw error;
    }
  }

  /**
   * حذف جميع البيانات
   */
  async clearAllData(key: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify([]));
    } catch (error) {
      console.error("Error clearing data:", error);
      throw error;
    }
  }

  /**
   * البحث في البيانات
   */
  async searchData(
    key: string,
    searchTerm: string,
    searchFields: string[] = []
  ): Promise<StorageData[]> {
    try {
      const allData = await this.getAllData(key);
      const lowerSearchTerm = searchTerm.toLowerCase();

      return allData.filter((item) => {
        if (searchFields.length === 0) {
          // البحث في جميع الحقول
          return JSON.stringify(item)
            .toLowerCase()
            .includes(lowerSearchTerm);
        }

        // البحث في حقول محددة
        return searchFields.some((field) => {
          const value = item[field];
          return (
            value &&
            String(value).toLowerCase().includes(lowerSearchTerm)
          );
        });
      });
    } catch (error) {
      console.error("Error searching data:", error);
      return [];
    }
  }

  /**
   * تصفية البيانات حسب معايير محددة
   */
  async filterData(
    key: string,
    filters: Record<string, any>
  ): Promise<StorageData[]> {
    try {
      const allData = await this.getAllData(key);

      return allData.filter((item) => {
        return Object.entries(filters).every(([field, value]) => {
          if (value === null || value === undefined) return true;
          return item[field] === value;
        });
      });
    } catch (error) {
      console.error("Error filtering data:", error);
      return [];
    }
  }

  /**
   * الحصول على البيانات مع الترتيب
   */
  async getSortedData(
    key: string,
    sortField: string,
    sortOrder: "asc" | "desc" = "asc"
  ): Promise<StorageData[]> {
    try {
      const allData = await this.getAllData(key);

      return allData.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    } catch (error) {
      console.error("Error sorting data:", error);
      return [];
    }
  }

  /**
   * الحصول على إحصائيات البيانات
   */
  async getStatistics(key: string): Promise<{
    total: number;
    createdToday: number;
    createdThisWeek: number;
    createdThisMonth: number;
  }> {
    try {
      const allData = await this.getAllData(key);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        now.getDate()
      );

      return {
        total: allData.length,
        createdToday: allData.filter(
          (item) => new Date(item.createdAt) >= today
        ).length,
        createdThisWeek: allData.filter(
          (item) => new Date(item.createdAt) >= weekAgo
        ).length,
        createdThisMonth: allData.filter(
          (item) => new Date(item.createdAt) >= monthAgo
        ).length,
      };
    } catch (error) {
      console.error("Error getting statistics:", error);
      return {
        total: 0,
        createdToday: 0,
        createdThisWeek: 0,
        createdThisMonth: 0,
      };
    }
  }
}

export const localStorageService = new LocalStorageService();
export { STORAGE_KEYS };
