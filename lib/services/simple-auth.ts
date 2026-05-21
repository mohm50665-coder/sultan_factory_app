import AsyncStorage from "@react-native-async-storage/async-storage";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  role: string;
  createdAt?: string;
}

interface StoredUser extends User {
  password: string;
}

const USERS_KEY = "users";
const CURRENT_USER_KEY = "currentUser";

// Initialize with default admin user
async function initializeUsers() {
  try {
    const existing = await AsyncStorage.getItem(USERS_KEY);
    if (!existing) {
      const defaultUsers: StoredUser[] = [
        {
          id: "1",
          name: "المدير العام",
          email: "admin@sultan.com",
          phone: "0501234567",
          position: "مدير عام",
          role: "admin",
          password: "123456",
        },
      ];
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    }
  } catch (error) {
    console.error("Failed to initialize users:", error);
  }
}

export const simpleAuthService = {
  async register(data: {
    name: string;
    email: string;
    phone: string;
    position: string;
    password: string;
  }): Promise<User> {
    try {
      await initializeUsers();
      
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      // Check if email already exists
      if (users.some((u) => u.email === data.email)) {
        throw new Error("البريد الإلكتروني مسجل بالفعل");
      }

      const newUser: StoredUser = {
        id: Date.now().toString(),
        name: data.name,
        email: data.email,
        phone: data.phone,
        position: data.position,
        password: data.password,
        role: "user",
      };

      users.push(newUser);
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

      // Auto login after registration
      const { password, ...userWithoutPassword } = newUser;
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));

      return userWithoutPassword;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  async login(email: string, password: string): Promise<User> {
    try {
      await initializeUsers();
      
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      const user = users.find((u) => u.email === email && u.password === password);
      if (!user) {
        throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      }

      const { password: _, ...userWithoutPassword } = user;
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));

      return userWithoutPassword;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(CURRENT_USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error("Get current user error:", error);
      return null;
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      const user = users.find((u) => u.email === email);
      if (!user) {
        throw new Error("البريد الإلكتروني غير مسجل");
      }

      // In a real app, send reset email
      console.log(`Password reset requested for ${email}`);
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  },

  async updateProfile(data: {
    name?: string;
    email?: string;
    phone?: string;
    position?: string;
  }): Promise<User> {
    try {
      const currentUserJson = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (!currentUserJson) {
        throw new Error("لا يوجد مستخدم مسجل دخول");
      }

      const currentUser = JSON.parse(currentUserJson) as User;
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      // Find and update user
      const userIndex = users.findIndex((u) => u.id === currentUser.id);
      if (userIndex === -1) {
        throw new Error("المستخدم غير موجود");
      }

      // Check if new email already exists
      if (data.email && data.email !== currentUser.email) {
        if (users.some((u) => u.email === data.email && u.id !== currentUser.id)) {
          throw new Error("البريد الإلكتروني مسجل بالفعل");
        }
      }

      // Update user data
      const updatedUser: StoredUser = {
        ...users[userIndex],
        name: data.name ?? users[userIndex].name,
        email: data.email ?? users[userIndex].email,
        phone: data.phone ?? users[userIndex].phone,
        position: data.position ?? users[userIndex].position,
      };

      users[userIndex] = updatedUser;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

      // Update current user
      const { password: _, ...userWithoutPassword } = updatedUser;
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));

      return userWithoutPassword;
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    }
  },
};
