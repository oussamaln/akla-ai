import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Award,
  ChevronDown,
  Compass,
  LayoutDashboard,
  Link2,
  LogOut,
  Medal,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const primaryNav = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Compass, label: "Quests", path: "/quests" },
  { icon: Link2, label: "Proof of Passage", path: "/proof-of-passage" },
  { icon: Medal, label: "Leaderboard", path: "/leaderboard" },
  { icon: Award, label: "Referrals", path: "/referrals" },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-400 via-violet-500 to-fuchsia-500 text-white shadow-[0_10px_24px_rgba(139,92,246,.34)]">
        <span className="font-display text-lg font-bold tracking-tighter">
          A
        </span>
      </span>
      <span className="font-display text-lg font-semibold tracking-[-0.04em] text-white group-data-[collapsible=icon]:hidden">
        Akla AI
      </span>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <section className="panel-surface w-full max-w-md p-8 text-center sm:p-10">
          <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
            <Award className="h-7 w-7" />
          </div>
          <p className="eyebrow justify-center">Member rewards</p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-white">
            Your network, rewarded.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in to build your Akla AI Network Score through community
            participation.
          </p>
          <Button
            onClick={() => startLogin()}
            className="mt-7 w-full bg-violet-500 text-white hover:bg-violet-400"
          >
            Sign in to Akla AI
          </Button>
        </section>
      </main>
    );
  }
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const active =
    primaryNav.find(item => item.path === location)?.label ??
    (location.startsWith("/admin") ? "Admin" : "Akla AI");
  const initials = (user?.name || "A")
    .split(" ")
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        className="border-r border-white/[0.07] bg-[#101026]"
      >
        <SidebarHeader className="h-20 justify-center px-4">
          <Brand />
        </SidebarHeader>
        <SidebarContent className="px-3 pt-3">
          <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 group-data-[collapsible=icon]:hidden">
            Member space
          </p>
          <SidebarMenu>
            {primaryNav.map(item => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={location === item.path}
                  onClick={() => setLocation(item.path)}
                  tooltip={item.label}
                  className="h-11 rounded-xl px-3 text-slate-400 hover:bg-white/[0.06] hover:text-white data-[active=true]:bg-violet-500/15 data-[active=true]:text-violet-200"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          {user?.role === "admin" && (
            <div className="mt-8 border-t border-white/[0.06] pt-5">
              <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 group-data-[collapsible=icon]:hidden">
                Operations
              </p>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location === "/admin"}
                    onClick={() => setLocation("/admin")}
                    tooltip="Admin console"
                    className="h-11 rounded-xl px-3 text-slate-400 hover:bg-white/[0.06] hover:text-white data-[active=true]:bg-amber-400/10 data-[active=true]:text-amber-200"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Admin console</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          )}
        </SidebarContent>
        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-9 w-9 border border-white/10 bg-violet-500/15">
                  <AvatarFallback className="bg-transparent text-xs font-semibold text-violet-200">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-sm font-medium text-white">
                    {user?.name || "Member"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {user?.role === "admin" ? "Administrator" : "Akla member"}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 border-white/10 bg-[#191832] text-slate-200"
            >
              <DropdownMenuLabel className="text-xs font-medium text-slate-400">
                Your Akla account
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={() => setLocation("/profile")}
                className="cursor-pointer focus:bg-white/10 focus:text-white"
              >
                <UserRound className="mr-2 h-4 w-4" />
                Edit profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-screen bg-[#0b0b1b]">
        {isMobile && (
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.07] bg-[#0b0b1b]/90 px-4 backdrop-blur-xl">
            <SidebarTrigger className="rounded-lg border border-white/10 bg-white/[0.04] text-slate-300" />
            <Brand />
            <span className="ml-auto text-xs font-medium text-slate-500">
              {active}
            </span>
          </header>
        )}
        <main className="min-h-screen px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
