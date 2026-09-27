"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "~/lib/auth-context";
import { useTheme } from "~/lib/theme-provider";
import { CelisLogo } from "~/components/branding/celis-logo";
import { NotificationBell } from "~/components/notifications/notification-bell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  LayoutDashboard,
  User,
  LogOut,
  Sun,
  Moon,
  Menu,
  Grid2X2,
  Bell,
} from "lucide-react";

interface SiteHeaderProps {
  showSearch?: boolean;
}

export function SiteHeader({ showSearch = true }: SiteHeaderProps) {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-celis-border bg-celis-bg/85 backdrop-blur-lg">
      <div className="mx-auto flex min-h-[3.5rem] max-w-7xl items-center gap-3 px-4 md:min-h-[4rem]">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <CelisLogo variant="primary" size={40} />
        </Link>

        {showSearch && (
          <form
            action="/search"
            method="get"
            className="hidden min-w-0 flex-1 items-center lg:flex"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const query = new FormData(form).get("q") as string;
              const params = new URLSearchParams();
              if (query) params.set("query", query);
              router.push(`/search${params.size ? `?${params}` : ""}`);
            }}
          >
            <div className="relative w-full max-w-sm xl:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-celis-ink-tertiary" />
              <Input
                name="q"
                placeholder="Search items..."
                className="h-11 w-full rounded-full border-celis-border bg-celis-surface-inset pl-10 pr-4 transition focus:bg-celis-surface-base"
              />
            </div>
          </form>
        )}

        <nav className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden lg:inline-flex"
          >
            <Link href="/browse">Browse</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden lg:inline-flex"
          >
            <Link href="/search">Search</Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="h-12 w-12 text-celis-ink-secondary"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <div className="hidden items-center gap-1 md:flex md:gap-2">
            {user ? (
              <>
                <NotificationBell />
                <Button size="sm" asChild>
                  <Link href="/sell">
                    <Plus className="mr-1 h-4 w-4" />
                    Sell
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Open account menu"
                      className="h-12 w-12"
                    >
                      <User className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href="/account">
                        <User className="mr-2 h-4 w-4" />
                        Account
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={user.isInternal ? "/admin" : "/dashboard"}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="lg:hidden">
                      <Link href="/browse">
                        <Grid2X2 className="mr-2 h-4 w-4" />
                        Browse
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="lg:hidden">
                      <Link href="/search">
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={loggingOut}
                      onSelect={(event) => {
                        event.preventDefault();
                        handleLogout();
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/auth/sign-in">Sign in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth/sign-up">Get started</Link>
                </Button>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </nav>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Menu</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button variant="ghost" asChild className="justify-start">
              <Link href="/browse" onClick={() => setMenuOpen(false)}>
                Browse
              </Link>
            </Button>
            <Button variant="ghost" asChild className="justify-start">
              <Link href="/search" onClick={() => setMenuOpen(false)}>
                Search
              </Link>
            </Button>
            <Separator />
            {user ? (
              <>
                <Button variant="ghost" asChild className="justify-start">
                  <Link href="/notifications" onClick={() => setMenuOpen(false)}>
                    <Bell className="mr-2 h-4 w-4" />
                    Notifications
                  </Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                  <Link href="/account" onClick={() => setMenuOpen(false)}>
                    <User className="mr-2 h-4 w-4" />
                    Account
                  </Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                  <Link href={user.isInternal ? "/admin" : "/dashboard"}
                    onClick={() => setMenuOpen(false)}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button variant="ghost" asChild className="justify-start">
                  <Link href="/sell" onClick={() => setMenuOpen(false)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Sell
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  disabled={loggingOut}
                  onClick={async () => {
                    setMenuOpen(false);
                    await handleLogout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" asChild className="justify-start">
                  <Link href="/auth/sign-in" onClick={() => setMenuOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild className="justify-start">
                  <Link href="/auth/sign-up" onClick={() => setMenuOpen(false)}>
                    Get started
                  </Link>
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
