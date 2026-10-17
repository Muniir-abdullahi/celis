"use client";

import Link from "next/link";
import { CelisLogo } from "~/components/branding/celis-logo";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/lib/auth-context";
import { MapPin, Mail, Phone } from "lucide-react";

export function SiteFooter() {
  const { user, logout } = useAuth();

  return (
    <footer className="border-t border-celis-border bg-celis-surface-base">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4">
            <CelisLogo variant="mark-only" size={32} badge />
            <p className="text-sm text-celis-ink-secondary">
              Somalia&apos;s trusted marketplace for buying and selling locally.
            </p>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Marketplace</h4>
            <ul className="space-y-2 text-sm text-celis-ink-secondary">
              <li><Link href="/browse" className="hover:text-celis-ink">Browse</Link></li>
              <li><Link href="/search" className="hover:text-celis-ink">Search</Link></li>
              <li><Link href="/sell" className="hover:text-celis-ink">Sell an item</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Account</h4>
            <ul className="space-y-2 text-sm text-celis-ink-secondary">
              {user ? (
                <>
                  <li>
                    <Link href={user.isInternal ? "/admin" : "/dashboard"}
                      className="hover:text-celis-ink"
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => logout()}
                      className="h-auto p-0 text-celis-ink-secondary hover:text-celis-ink"
                    >
                      Log out
                    </Button>
                  </li>
                </>
              ) : (
                <>
                  <li><Link href="/auth/sign-in" className="hover:text-celis-ink">Sign in</Link></li>
                  <li><Link href="/auth/sign-up" className="hover:text-celis-ink">Create account</Link></li>
                </>
              )}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Contact</h4>
            <ul className="space-y-3 text-sm text-celis-ink-secondary">
              <li className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" /><a href="tel:+252610717124" className="hover:text-celis-ink">+252 61 0717124</a></li>
              <li className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><a href="mailto:hello@celis.so" className="hover:text-celis-ink">hello@celis.so</a></li>
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>Xaawo Taako Section, Wadajir District, Mogadishu, Banaadir</span></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Trust</h4>
            <ul className="space-y-2 text-sm text-celis-ink-secondary">
              <li>Mobile money payments</li>
              <li>Verified seller profiles</li>
              <li>Transparent fees</li>
            </ul>
          </div>
        </div>
        <Separator className="my-8" />
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-celis-ink-secondary sm:flex-row">
          <p>© Celis. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-celis-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-celis-ink">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
