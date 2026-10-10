import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LogOut,
  RadioTower,
  Settings,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";

import { NavLink } from "react-router-dom";

import { useAuth } from "../features/auth/useAuth";

const navigation = [
  {
    label: "Dashboard",

    path: "/admin/dashboard",

    icon: LayoutDashboard,
  },

  {
    label: "Guests",

    path: "/admin/guests",

    icon: Users,
  },

  {
    label: "User Management",

    path: "/admin/users",

    icon: UserCog,
  },

  {
    label: "Rooms",

    path: "/admin/rooms",

    icon: BedDouble,
  },

  {
    label: "Reservations",

    path: "/admin/reservations",

    icon: CalendarDays,
  },

  {
    label: "NFC Management",

    path: "/admin/nfc",

    icon: RadioTower,
  },

  {
    label: "Payments",

    path: "/admin/payments",

    icon: CreditCard,
  },

  {
    label: "Transactions",

    path: "/admin/transactions",

    icon: WalletCards,
  },

  {
    label: "Reports",

    path: "/admin/reports",

    icon: BarChart3,
  },

  {
    label: "Settings",

    path: "/admin/settings",

    icon: Settings,
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  const visibleNavigation = navigation.filter(
    (item) => !item.adminOnly || user?.role === "ADMIN",
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Building2 size={32} />

        <div>
          <strong>CONDOTEL</strong>

          <span>NFC SYSTEM WITH PAYMENT</span>
        </div>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-avatar">
          {user?.firstName?.charAt(0)?.toUpperCase() || "A"}
        </div>

        <div>
          <strong>{user?.firstName || "Admin"}</strong>

          <span>{user?.role || "Administrator"}</span>
        </div>
      </div>

      <nav className="sidebar-navigation">
        {visibleNavigation.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <Icon size={18} />

            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button type="button" className="sidebar-logout" onClick={logout}>
        <LogOut size={18} />
        Sign Out
      </button>
    </aside>
  );
}
