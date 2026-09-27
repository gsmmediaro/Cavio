import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Settings, HelpCircle } from "lucide-react";
import { Separator } from "@notra/ui/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@notra/ui/components/ui/avatar";
import { SidebarTrigger } from "@notra/ui/components/ui/sidebar";

import { useAuth } from "../../contexts/AuthContext";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const TITLE_BY_PATH: Record<string, string> = {
  "/analyze": "Analyze",
  "/history": "History",
  "/settings": "Settings",
  "/terms": "Terms",
  "/privacy": "Privacy",
};

export function SiteHeader() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, logout } = useAuth();

  const base = "/" + (location.pathname.split("/").filter(Boolean)[0] ?? "analyze");
  const title = TITLE_BY_PATH[base] ?? "Cavio";

  const displayName = userProfile
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
    : user?.displayName || user?.email || "";
  const userInitials = displayName
    ? initials(displayName)
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex h-full w-full min-w-0 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-1 data-[orientation=vertical]:h-4"
        />
        <h1 className="truncate text-sm font-medium text-foreground">{title}</h1>
        <div className="ml-auto flex items-center gap-1">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Account"
                    className="ring-sidebar-ring data-popup-open:ring-sidebar-border/70 shrink-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 data-popup-open:ring-1"
                  >
                    <Avatar className="size-7 rounded-lg after:rounded-lg">
                      <AvatarFallback className="bg-primary/15 text-primary flex items-center justify-center rounded-lg text-[0.6875rem] font-medium">
                        <span className="-translate-y-px">{userInitials}</span>
                      </AvatarFallback>
                    </Avatar>
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-56 rounded-lg">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {displayName || "Account"}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {user.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="size-4" />
                  {t("layout.nav.settings")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open("mailto:hello@cavio.ai", "_blank")}
                >
                  <HelpCircle className="size-4" />
                  {t("layout.nav.help")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="size-4" />
                  {t("layout.nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}
