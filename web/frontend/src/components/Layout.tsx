import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  MessageCircle,
  History,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
} from "@notra/ui/components/ui/sidebar";
import { Button } from "@notra/ui/components/ui/button";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { cn } from "@notra/ui/lib/utils";

import { getPatientsFromFirestore, type PatientSummary } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { SiteHeader } from "./shell/site-header";

function suspicionDotColor(s: string): string {
  switch (s) {
    case "HIGH":
      return "var(--color-high)";
    case "MODERATE":
      return "var(--color-moderate)";
    case "REVIEW":
      return "var(--color-review)";
    default:
      return "var(--color-low)";
  }
}

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, setShowAuthGate } = useAuth();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const refreshPatients = useCallback(() => {
    if (!user) return;
    getPatientsFromFirestore(user.uid).then(setPatients);
  }, [user]);

  useEffect(() => {
    if (user) refreshPatients();
  }, [user, refreshPatients]);

  useEffect(() => {
    const handler = () => refreshPatients();
    window.addEventListener("cavio:patients-updated", handler);
    return () => window.removeEventListener("cavio:patients-updated", handler);
  }, [refreshPatients]);

  const handleNewScan = () => {
    setSelectedPatient(null);
    navigate(`/analyze?new=${Date.now()}`);
  };

  const handlePatientClick = (name: string) => {
    setSelectedPatient(name);
    navigate(`/analyze?patient=${encodeURIComponent(name)}`);
  };

  /* Logged-out: Notra-ish top chrome (light), keep Cavio routes */
  if (!user) {
    return (
      <div className="bg-background flex min-h-svh flex-col">
        <header className="bg-card sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 md:px-6">
          <img src="/Cavio Header.png" alt="Cavio" className="h-7" />
          <CtaButton type="button" size="default" className="h-8 px-4 text-sm" onClick={() => setShowAuthGate(true)}>
            {t("layout.nav.logIn")}
          </CtaButton>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="bg-sidebar flex h-svh flex-col overflow-hidden overscroll-none">
      <SidebarProvider defaultOpen className="min-h-0! flex-1 overflow-hidden overscroll-none">
        <Sidebar collapsible="icon" variant="inset" className="overscroll-none border-none">
          <SidebarHeader className="gap-2">
            <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center">
              <img
                src="/Cavio Header.png"
                alt="Cavio"
                className="h-6 group-data-[collapsible=icon]:hidden"
              />
              <img
                src="/Cavio Logo.png"
                alt="Cavio"
                className="hidden size-7 group-data-[collapsible=icon]:block"
              />
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t("layout.nav.newScan")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  onClick={handleNewScan}
                >
                  <Plus className="size-4" />
                  <span>{t("layout.nav.newScan")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>{t("layout.nav.recentScans")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {patients.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-3 text-xs">
                      {t("layout.patients.noScans")}
                    </div>
                  ) : (
                    patients.slice(0, 10).map((p) => (
                      <SidebarMenuItem key={p.name}>
                        <SidebarMenuButton
                          isActive={selectedPatient === p.name}
                          tooltip={p.name}
                          onClick={() => handlePatientClick(p.name)}
                        >
                          <MessageCircle className="size-4" />
                          <span className="truncate">{p.name}</span>
                          <SidebarMenuBadge>
                            <span
                              className="size-1.5 rounded-full"
                              style={{ background: suspicionDotColor(p.worst_suspicion) }}
                            />
                          </SidebarMenuBadge>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                  {patients.length > 0 ? (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={location.pathname.startsWith("/history")}
                        tooltip={t("layout.nav.viewAll")}
                        onClick={() => navigate("/history")}
                      >
                        <History className="size-4" />
                        <span>{t("layout.nav.viewAll")}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : null}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarSeparator />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname.startsWith("/settings")}
                  tooltip={t("layout.nav.settings")}
                  onClick={() => navigate("/settings")}
                >
                  <Settings className="size-4" />
                  <span>{t("layout.nav.settings")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t("layout.nav.help")}
                  onClick={() => window.open("mailto:hello@cavio.ai", "_blank")}
                >
                  <HelpCircle className="size-4" />
                  <span>{t("layout.nav.help")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={t("layout.nav.logout")} onClick={() => logout()}>
                  <LogOut className="size-4" />
                  <span>{t("layout.nav.logout")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className={cn("min-h-0 min-w-0 overflow-hidden")}>
          <SiteHeader />
          <div className="scrollbar-stable @container/main flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-contain">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
