import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient();

function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 select-none">
          <div className="size-6 rounded-md bg-gradient-to-br from-primary to-emerald-400" />
          <span className={cn("font-extrabold tracking-tight")}>HashTrack</span>
        </Link>
        <nav className="text-sm text-muted-foreground">
          <a href="/" className="hover:text-foreground transition-colors">
            Home
          </a>
        </nav>
      </div>
    </header>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
