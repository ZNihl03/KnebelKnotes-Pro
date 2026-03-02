import { useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type AuthBarProps = {
  variant?: "desktop" | "mobile";
};

const AuthBar = ({ variant = "desktop" }: AuthBarProps) => {
  const { user, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const isCompact = variant === "desktop";

  const handleLogout = async () => {
    setBusy(true);
    const { error } = await signOut();
    setBusy(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Logged out.");
  };

  if (loading) {
    return <div className={cn("text-xs text-muted-foreground", isCompact ? "px-2" : "")}>Checking session...</div>;
  }

  if (!user) {
    return (
      <Button
        asChild
        size={isCompact ? "sm" : "default"}
        className={cn(isCompact ? "h-8 px-3 text-xs" : "w-full")}
      >
        <Link to="/login">Log in</Link>
      </Button>
    );
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.username ||
    user.email ||
    "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={isCompact ? "sm" : "default"}
          className={cn("gap-2", isCompact ? "h-8 px-3 text-xs" : "w-full justify-start")}
        >
          <UserRound className="h-4 w-4" />
          <span className={cn(isCompact ? "max-w-[140px]" : "", "truncate")}>{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isCompact ? "end" : "start"} className="w-44">
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
          }}
          disabled={busy}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AuthBar;
