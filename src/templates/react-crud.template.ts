export function generateReactFiles(): Record<string, string> {
  return {
    "tailwind.config.js": `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`,
    "postcss.config.js": `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    ".env.example": `VITE_API_URL=http://localhost:3000/api
`,
    "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-100 text-gray-900 antialiased;
}
`,
    "src/types/index.ts": `export interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

export interface Role {
  id: number;
  name: string;
  description: string;
}

export interface Permission {
  id: number;
  name: string;
  action: string;
}
`,
    "src/services/api.ts": `import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
`,
    "src/services/auth.service.ts": `import { api } from "./api";

interface LoginResponse {
  accessToken: string;
  email: string;
  name: string;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>("/auth/login", { email, password });
    return data;
  },
};
`,
    "src/services/crud.service.ts": `import { api } from "./api";
import type { Permission, Role, User } from "../types";

function createCrudService<T extends { id: number }>(resource: string) {
  return {
    getAll: () => api.get<T[]>("/" + resource).then((r) => r.data),
    getById: (id: number) => api.get<T>("/" + resource + "/" + id).then((r) => r.data),
    create: (payload: Partial<T>) => api.post<T>("/" + resource, payload).then((r) => r.data),
    update: (id: number, payload: Partial<T>) =>
      api.patch<T>("/" + resource + "/" + id, payload).then((r) => r.data),
    remove: (id: number) => api.delete<void>("/" + resource + "/" + id).then((r) => r.data),
  };
}

export const usersService = createCrudService<User>("users");
export const rolesService = createCrudService<Role>("roles");
export const permissionsService = createCrudService<Permission>("permissions");
`,
    "src/context/AuthContext.tsx": `import { createContext, useContext, useState, ReactNode } from "react";
import { authService } from "../services/auth.service";

interface SessionUser {
  email: string;
  name: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    localStorage.setItem("token", res.accessToken);
    localStorage.setItem("user", JSON.stringify({ email: res.email, name: res.name }));
    setUser({ email: res.email, name: res.name });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
`,
    "src/components/Layout.tsx": `import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/users", label: "Users" },
  { to: "/roles", label: "Roles" },
  { to: "/permissions", label: "Permissions" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col bg-slate-900 text-white">
        <div className="p-4 text-lg font-bold">Admin</div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive
                  ? "rounded-md bg-slate-700 px-3 py-2 text-sm font-medium"
                  : "rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-700 p-4">
          <p className="mb-2 truncate text-xs text-slate-400">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="w-full rounded-md bg-red-600 px-3 py-1.5 text-sm hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
`,
    "src/components/CrudPage.tsx": `import { useEffect, useState, FormEvent } from "react";

export interface CrudField {
  key: string;
  label: string;
  type?: "text" | "number" | "checkbox";
}

interface CrudService<T extends { id: number }> {
  getAll: () => Promise<T[]>;
  create: (payload: Partial<T>) => Promise<T>;
  update: (id: number, payload: Partial<T>) => Promise<T>;
  remove: (id: number) => Promise<void>;
}

interface Props<T extends { id: number }> {
  title: string;
  service: CrudService<T>;
  columns: CrudField[];
  fields: CrudField[];
}

export function CrudPage<T extends { id: number }>({ title, service, columns, fields }: Props<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [editing, setEditing] = useState<T | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = () => service.getAll().then(setItems);

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (item: T) => {
    setEditing(item);
    setShowModal(true);
  };

  const handleDelete = async (item: T) => {
    if (!window.confirm("Delete this record?")) return;
    await service.remove(item.id);
    load();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = formData.get(field.key);
      payload[field.key] = field.type === "number" ? Number(raw) : field.type === "checkbox" ? raw === "on" : String(raw ?? "");
    }

    if (editing) {
      await service.update(editing.id, payload as Partial<T>);
    } else {
      await service.create(payload as Partial<T>);
    }
    setShowModal(false);
    load();
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <button onClick={openCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          + New
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.id}>
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm">
                    {String((item as Record<string, unknown>)[col.key] ?? "-")}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(item)} className="mr-2 text-sm text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(item)} className="text-sm text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-sm text-gray-400">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">{editing ? "Edit" : "New"} {title}</h2>
            <div className="flex flex-col gap-3">
              {fields.map((field) => (
                <label key={field.key} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-gray-700">{field.label}</span>
                  {field.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      name={field.key}
                      defaultChecked={Boolean(editing && (editing as Record<string, unknown>)[field.key])}
                      className="h-4 w-4"
                    />
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      name={field.key}
                      defaultValue={
                        editing ? String((editing as Record<string, unknown>)[field.key] ?? "") : ""
                      }
                      required={!editing || !["isActive"].includes(field.key)}
                      className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
`,
    "src/components/ProtectedRoute.tsx": `import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
`,
    "src/pages/LoginPage.tsx": `import { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await login(e.currentTarget.email.value, e.currentTarget.password.value);
      navigate("/");
    } catch {
      alert("Invalid credentials");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold">Sign in</h1>
        <div className="flex flex-col gap-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
          <button type="submit" className="rounded-md bg-blue-600 py-2 text-white hover:bg-blue-700">
            Login
          </button>
        </div>
      </form>
    </div>
  );
}
`,
    "src/pages/DashboardPage.tsx": `export function DashboardPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome to your admin panel.</p>
    </section>
  );
}
`,
    "src/pages/UsersPage.tsx": `import { CrudPage, CrudField } from "../components/CrudPage";
import { usersService } from "../services/crud.service";
import { User } from "../types";

const columns: CrudField[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "isActive", label: "Active" },
];

const fields: CrudField[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email", type: "text" },
  { key: "password", label: "Password" },
  { key: "isActive", label: "Active", type: "checkbox" },
];

export default function UsersPage() {
  return <CrudPage<User> title="Users" service={usersService} columns={columns} fields={fields} />;
}
`,
    "src/pages/RolesPage.tsx": `import { CrudPage, CrudField } from "../components/CrudPage";
import { rolesService } from "../services/crud.service";
import { Role } from "../types";

const columns: CrudField[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
];

const fields: CrudField[] = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
];

export default function RolesPage() {
  return <CrudPage<Role> title="Roles" service={rolesService} columns={columns} fields={fields} />;
}
`,
    "src/pages/PermissionsPage.tsx": `import { CrudPage, CrudField } from "../components/CrudPage";
import { permissionsService } from "../services/crud.service";
import { Permission } from "../types";

const columns: CrudField[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Permission" },
  { key: "action", label: "Action" },
];

const fields: CrudField[] = [
  { key: "name", label: "Permission" },
  { key: "action", label: "Action" },
];

export default function PermissionsPage() {
  return (
    <CrudPage<Permission> title="Permissions" service={permissionsService} columns={columns} fields={fields} />
  );
}
`,
    "src/App.tsx": `import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import PermissionsPage from "./pages/PermissionsPage";
import RolesPage from "./pages/RolesPage";
import UsersPage from "./pages/UsersPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      {[["/users", UsersPage], ["/roles", RolesPage], ["/permissions", PermissionsPage]].map(
        ([path, Page]) => (
          <Route
            key={path as string}
            path={path as string}
            element={
              <ProtectedRoute>
                <Layout>
                  <Page />
                </Layout>
              </ProtectedRoute>
            }
          />
        )
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
`,
    "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
`,
  };
}

export const REACT_EXTRA_DEPS_CMD =
  'npm install axios react-router-dom && npm install -D tailwindcss@3 postcss autoprefixer';

export const NEST_EXTRA_DEPS_CMD =
  'npm install @nestjs/typeorm typeorm sqlite3 class-validator class-transformer @nestjs/jwt';
