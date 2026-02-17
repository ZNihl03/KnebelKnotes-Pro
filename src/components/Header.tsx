import { Link, useNavigate } from "react-router-dom";
import { Search, Menu, X, Brain } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const Header = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold leading-tight text-foreground">
              PsychRef
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Psychiatry Reference
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <Link
            to="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Home
          </Link>
          <Link
            to="/categories"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Categories
          </Link>
          <Link
            to="/search"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Search
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {/* Search toggle */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Toggle search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="border-t border-border bg-card px-4 py-3 animate-fade-in">
          <form onSubmit={handleSearch} className="container flex gap-2">
            <input
              type="text"
              placeholder="Search disorders, medications, criteria..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" size="sm">
              Search
            </Button>
          </form>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-border bg-card p-4 animate-fade-in md:hidden">
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Home
            </Link>
            <Link
              to="/categories"
              onClick={() => setMobileOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Categories
            </Link>
            <Link
              to="/search"
              onClick={() => setMobileOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Search
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
