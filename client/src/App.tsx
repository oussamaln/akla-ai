import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Admin from "./pages/Admin";
import Home from "./pages/Home";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Quests from "./pages/Quests";
import Referrals from "./pages/Referrals";

function Router() { return <Switch><Route path="/" component={Home} /><Route path="/quests" component={Quests} /><Route path="/leaderboard" component={Leaderboard} /><Route path="/referrals" component={Referrals} /><Route path="/profile" component={Profile} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
