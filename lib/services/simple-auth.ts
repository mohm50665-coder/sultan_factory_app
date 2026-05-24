import AsyncStorage from "@react-native-async-storage/async-storage";

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  role: string;
  isActive: boolean;
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
          username: "admin",
          email: "admin@sultan.com",
          phone: "0501234567",
          position: "مدير عام",
          department: "board_representative",
          role: "admin",
          password: "123456",
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ];
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    } else {
      // Migrate existing users to have username field if missing
      const users: StoredUser[] = JSON.parse(existing);
      let needsUpdate = false;
      users.forEach((u) => {
        if (!u.username) {
          u.username = u.email.split("@")[0] || u.name;
          needsUpdate = true;
        }
        if (u.isActive === undefined) {
          u.isActive = true;
          needsUpdate = true;
        }
        if (!u.department) {
          // Backfill department for existing users based on role
          if (u.role === "admin") {
            u.department = "board_representative";
          } else {
            u.department = "";
          }
          needsUpdate = true;
        }
      });
      if (needsUpdate) {
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
    }
  } catch (error) {
    console.error("Failed to initialize users:", error);
  }
}

export const simpleAuthService = {
  async register(data: {
    name: string;
    username: string;
    email?: string;
    phone: string;
    position: string;
    department: string;
    password: string;
  }): Promise<User> {
    try {
      await initializeUsers();

      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      // Check if username already exists
      if (users.some((u) => u.username === data.username)) {
        throw new Error("اسم المستخدم مسجل بالفعل");
      }

      const newUser: StoredUser = {
        id: Date.now().toString(),
        name: data.name,
        username: data.username,
        email: data.email || "",
        phone: data.phone,
        position: data.position,
        department: data.department,
        password: data.password,
        role: "user",
        isActive: true,
        createdAt: new Date().toISOString(),
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

  async login(username: string, password: string): Promise<User> {
    try {
      await initializeUsers();

      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      // Search by username or email for backward compatibility
      const user = users.find(
        (u) => (u.username === username || u.email === username) && u.password === password
      );
      if (!user) {
        throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
      }

      if (!user.isActive) {
        throw new Error("الحساب معطل. تواصل مع المدير");
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

  async resetPassword(username: string, phone: string, newPassword: string): Promise<void> {
    try {
      await initializeUsers();
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      const userIndex = users.findIndex(
        (u) => (u.username === username || u.email === username) && u.phone === phone
      );
      if (userIndex === -1) {
        throw new Error("البيانات غير صحيحة. تأكد من اسم المستخدم ورقم الجوال");
      }

      users[userIndex].password = newPassword;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      const user = users.find((u) => u.email === email || u.username === email);
      if (!user) {
        throw new Error("المستخدم غير مسجل");
      }

      console.log(`Password reset requested for ${email}`);
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  },

  async updateProfile(data: {
    name?: string;
    username?: string;
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

      const userIndex = users.findIndex((u) => u.id === currentUser.id);
      if (userIndex === -1) {
        throw new Error("المستخدم غير موجود");
      }

      // Check if new username already exists
      if (data.username && data.username !== currentUser.username) {
        if (users.some((u) => u.username === data.username && u.id !== currentUser.id)) {
          throw new Error("اسم المستخدم مسجل بالفعل");
        }
      }

      const updatedUser: StoredUser = {
        ...users[userIndex],
        name: data.name ?? users[userIndex].name,
        username: data.username ?? users[userIndex].username,
        email: data.email ?? users[userIndex].email,
        phone: data.phone ?? users[userIndex].phone,
        position: data.position ?? users[userIndex].position,
      };

      users[userIndex] = updatedUser;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

      const { password: _, ...userWithoutPassword } = updatedUser;
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));

      return userWithoutPassword;
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    }
  },

  // ===== إدارة المستخدمين (Admin) =====
  async getAllUsers(): Promise<User[]> {
    try {
      await initializeUsers();
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];
      return users.map(({ password, ...u }) => u);
    } catch (error) {
      console.error("Get all users error:", error);
      return [];
    }
  },

  async updateUser(userId: string, data: Partial<Omit<StoredUser, "id">>): Promise<User> {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex === -1) {
        throw new Error("المستخدم غير موجود");
      }

      users[userIndex] = { ...users[userIndex], ...data };
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

      const { password: _, ...userWithoutPassword } = users[userIndex];
      return userWithoutPassword;
    } catch (error) {
      console.error("Update user error:", error);
      throw error;
    }
  },

  async deleteUser(userId: string): Promise<void> {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      const filtered = users.filter((u) => u.id !== userId);
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error("Delete user error:", error);
      throw error;
    }
  },

  async toggleUserActive(userId: string): Promise<User> {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex === -1) {
        throw new Error("المستخدم غير موجود");
      }

      users[userIndex].isActive = !users[userIndex].isActive;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

      const { password: _, ...userWithoutPassword } = users[userIndex];
      return userWithoutPassword;
    } catch (error) {
      console.error("Toggle user active error:", error);
      throw error;
    }
  },

  async changeUserRole(userId: string, newRole: string): Promise<User> {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex === -1) {
        throw new Error("المستخدم غير موجود");
      }

      users[userIndex].role = newRole;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

      const { password: _, ...userWithoutPassword } = users[userIndex];
      return userWithoutPassword;
    } catch (error) {
      console.error("Change user role error:", error);
      throw error;
    }
  },

  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_KEY);
      const users: StoredUser[] = usersJson ? JSON.parse(usersJson) : [];

      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex === -1) {
        throw new Error("المستخدم غير موجود");
      }

      users[userIndex].password = newPassword;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (error) {
      console.error("Reset user password error:", error);
      throw error;
    }
  },
};
