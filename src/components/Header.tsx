import { Link, useNavigate } from "react-router-dom";
import { Search, Menu, X, Settings, Home, LayoutGrid, Shield, ArrowLeft, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import knebelLogo from "@/assets/knebel-logo.png";
import AuthBar from "@/components/AuthBar";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useUiPreferences } from "@/contexts/UiPreferencesContext";
import { cn } from "@/lib/utils";
import { KNEBEL_MAIN_WEBSITE_LABEL, KNEBEL_MAIN_WEBSITE_URL } from "@/lib/siteLinks";
import { supabase } from "@/lib/supabaseClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HeaderCategory = {
  id: string;
  short_code: string;
  name: string;
};

const Header = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<HeaderCategory[]>([]);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showCategoryIds } = useUiPreferences();
  const showSubAdminTab = profile?.role === "sub_admin";

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, short_code, name")
        .order("name", { ascending: true });

      if (!isMounted || error) {
        return;
      }

      setCategories(data ?? []);
    };

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const headerClass = "sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70";

  const navLinkClass = cn(
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    "text-black hover:text-black/80 dark:text-white dark:hover:text-white/80",
  );

  const logoTitleClass = cn(
    "max-w-[160px] truncate font-display text-base font-bold leading-tight sm:max-w-none sm:text-lg",
    "text-black dark:text-white",
  );

  const logoSubtitleClass = cn(
    "hidden text-[10px] font-medium uppercase tracking-widest sm:block",
    "text-muted-foreground",
  );

  const iconButtonClass = cn(
    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
    "text-black hover:text-black/80 dark:text-white dark:hover:text-white/80 hover:bg-muted",
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    navigate(`/category/${categoryId}`);
    setMobileOpen(false);
    setMobileCategoryOpen(false);
  };

  return (
    <header className={headerClass}>
      <div className="container flex h-14 items-center justify-between gap-3 sm:h-16">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={knebelLogo} alt="Knebel Knotes logo" className="h-8 w-8 sm:h-9 sm:w-9" />
          <div className="flex flex-col">
            <span className={logoTitleClass}>
              Knebel Knotes
            </span>
            <span className={logoSubtitleClass}>
              Psychiatry Reference
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1.5 md:flex">
          <Link
            to="/"
            className={navLinkClass}
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={navLinkClass}>
                <LayoutGrid className="h-4 w-4" />
                Category
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel>Choose a category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.length > 0 ? (
                categories.map((category) => (
                  <DropdownMenuItem key={category.id} onSelect={() => handleCategorySelect(category.id)}>
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                    {showCategoryIds && (
                      <span className="ml-3 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {category.short_code}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No categories available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            to="/search"
            className={navLinkClass}
          >
            <Search className="h-4 w-4" />
            Search
          </Link>
          {showSubAdminTab && (
            <Link
              to="/sub-admin"
              className={navLinkClass}
            >
              <Shield className="h-4 w-4" />
              Sub Admin
            </Link>
          )}
          <Button asChild variant="outline" size="sm" className="ml-2 gap-2">
            <a href={KNEBEL_MAIN_WEBSITE_URL}>
              <ArrowLeft className="h-4 w-4" />
              {KNEBEL_MAIN_WEBSITE_LABEL}
            </a>
          </Button>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center md:flex">
            <AuthBar variant="desktop" />
          </div>

          <ThemeToggle />
          <Link
            to="/settings"
            className={cn(iconButtonClass, "hidden sm:flex")}
            aria-label="Account settings"
          >
            <Settings className="h-4 w-4" />
          </Link>

          {/* Search toggle */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={iconButtonClass}
            aria-label="Toggle search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(iconButtonClass, "md:hidden")}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="border-t border-border/70 bg-background/95 px-4 py-3 animate-fade-in">
          <form onSubmit={handleSearch} className="container flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              placeholder="Search disorders, medications, criteria..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" size="sm" className="w-full sm:w-auto">
              Search
            </Button>
          </form>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-border/70 bg-background/95 p-3 animate-fade-in md:hidden sm:p-4">
          <div className="flex flex-col gap-1.5">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-black hover:bg-muted dark:text-white"
            >
              <Home className="h-5 w-5" />
              Home
            </Link>
            <div className="rounded-lg border border-border/70">
              <button
                type="button"
                onClick={() => setMobileCategoryOpen((prev) => !prev)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-black transition-colors hover:bg-muted dark:text-white"
              >
                <LayoutGrid className="h-5 w-5" />
                Category
                <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", mobileCategoryOpen && "rotate-180")} />
              </button>
              {mobileCategoryOpen && (
                <div className="border-t border-border/70 px-2 py-2">
                  <div className="flex flex-col gap-1">
                    {categories.length > 0 ? (
                      categories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => handleCategorySelect(category.id)}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-black transition-colors hover:bg-muted dark:text-white"
                        >
                          <span className="truncate">{category.name}</span>
                          {showCategoryIds && (
                            <span className="ml-3 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              {category.short_code}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No categories available</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link
              to="/search"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-black hover:bg-muted dark:text-white"
            >
              <Search className="h-5 w-5" />
              Search
            </Link>
            <Link
              to="/settings"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-black hover:bg-muted dark:text-white"
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
            {showSubAdminTab && (
              <Link
                to="/sub-admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-black hover:bg-muted dark:text-white"
              >
                <Shield className="h-5 w-5" />
                Sub Admin
              </Link>
            )}
            <a
              href={KNEBEL_MAIN_WEBSITE_URL}
              onClick={() => setMobileOpen(false)}
              className="mt-1 flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-base font-medium text-black transition-colors hover:bg-muted dark:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
              {KNEBEL_MAIN_WEBSITE_LABEL}
            </a>
          </div>
          <div className="mt-4 border-t border-border/70 pt-4">
            <AuthBar variant="mobile" />
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
