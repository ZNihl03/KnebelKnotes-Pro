import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

type AuthBarProps = {
  variant?: "desktop" | "mobile";
};

const AuthBar = ({ variant = "desktop" }: AuthBarProps) => {
  const { user, profile, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const isCompact = variant === "desktop";

  useEffect(() => {
    let isMounted = true;
    const loadAvatar = async () => {
      if (!profile?.profile_image_path) {
        if (isMounted) setAvatarUrl(null);
        return;
      }
      const { data, error } = await supabase.storage
        .from("admin-profile-images")
        .createSignedUrl(profile.profile_image_path, 60 * 60);
      if (!isMounted) return;
      if (error) {
        setAvatarUrl(null);
        return;
      }
      setAvatarUrl(data.signedUrl);
    };

    void loadAvatar();
    return () => {
      isMounted = false;
    };
  }, [profile]);

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

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={isCompact ? "sm" : "default"}
          className={cn("gap-2", isCompact ? "h-8 px-3 text-xs" : "w-full justify-start")}
        >
          <Avatar className={cn(isCompact ? "h-7 w-7" : "h-8 w-8")}>
            <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
            <AvatarFallback className="text-[10px]">{initials || <UserRound className="h-3 w-3" />}</AvatarFallback>
          </Avatar>
          <span className={cn(isCompact ? "max-w-[140px]" : "", "truncate")}>{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isCompact ? "end" : "start"} className="w-44">
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
