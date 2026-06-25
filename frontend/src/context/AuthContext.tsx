import {
  createContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  setAuth: (token: string, user: User) => void;   // ✅ NEW
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }

    setLoading(false);
  }, []);

  // ✅ NEW: Directly set auth state without API call
  const setAuth = (newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      const { token, user } = res.data.data;
      setAuth(token, user);
      toast.success("Login successful!");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Login failed");
      throw error;
    }
  };

  const register = async (email: string, name: string, password: string) => {
    try {
      const res = await api.post("/auth/register", { email, name, password });
      const { token, user } = res.data.data;
      setAuth(token, user);
      toast.success("Registration successful!");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Registration failed");
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    toast.success("Logged out");
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      setAuth,       // ✅ NEW
    }),
    [user, token, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}