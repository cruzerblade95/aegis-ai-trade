"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    href: "/dashboard",
    label: "Overview",
  },
  {
    href: "/market",
    label: "Market Lab",
  },
  {
    href: "/risk",
    label: "Risk Lab",
  },
  {
    href: "/progress",
    label: "Progress",
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard navigation"
      className="dashboard-nav"
    >
      {navigation.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            pathname.startsWith(`${item.href}/`));

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "dashboard-nav-link dashboard-nav-link-active"
                : "dashboard-nav-link"
            }
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}