import { Link } from "@tanstack/react-router";

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const items: Array<{ to: string; label: string }> = [
    { to: "/home", label: "Home" },
    { to: "/matches", label: "Partite" },
    { to: "/standings", label: "Classifica" },
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
    { to: "/profile", label: "Profilo" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card">
      <ul className="mx-auto flex w-full max-w-md">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <Link
              to={item.to}
              className="block py-3 text-center text-xs font-medium text-muted-foreground"
              activeProps={{ className: "block py-3 text-center text-xs font-semibold text-foreground" }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
