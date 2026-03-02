import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type FloatingNavItem = {
  name: string;
  link: string;
  icon?: React.ReactNode;
};

type FloatingNavProps = {
  navItems: FloatingNavItem[];
  activeLink?: string;
  onNavigate?: (link: string) => void;
  className?: string;
  position?: "fixed" | "static";
  orientation?: "horizontal" | "vertical";
  placement?: "center" | "left";
};

const FloatingNav = ({
  navItems,
  activeLink,
  onNavigate,
  className,
  position = "fixed",
  orientation = "horizontal",
  placement = "center",
}: FloatingNavProps) => {
  const [visible, setVisible] = useState(true);
  const isFixed = position === "fixed";
  const isVertical = orientation === "vertical";

  useEffect(() => {
    if (!isFixed) {
      setVisible(true);
      return;
    }
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const current = window.scrollY;
      const isNearTop = current < 80;
      const scrollingUp = current < lastScrollY;
      setVisible(isNearTop || scrollingUp);
      lastScrollY = current;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isFixed]);

  return (
    <div
      className={cn(
        isFixed
          ? placement === "left"
            ? "fixed left-4 top-1/2 z-50 -translate-y-1/2"
            : "fixed left-1/2 z-50 -translate-x-1/2"
          : "relative mx-auto w-fit",
        "transition-all duration-300",
        isVertical
          ? "rounded-2xl border border-border bg-card/95 px-2 py-2 shadow-lg backdrop-blur"
          : "rounded-full border border-border bg-card/95 px-2 py-1 shadow-lg backdrop-blur",
        !isFixed || visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0 pointer-events-none",
        className,
      )}
    >
      <nav className={cn("flex items-center gap-1", isVertical && "flex-col")}>
        {navItems.map((item) => {
          const isActive = activeLink === item.link;
          return (
            <a
              key={item.link}
              href={item.link}
              onClick={(event) => {
                if (onNavigate) {
                  event.preventDefault();
                  onNavigate(item.link);
                }
              }}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon ? <span className="h-4 w-4">{item.icon}</span> : null}
              {!isVertical && <span>{item.name}</span>}
            </a>
          );
        })}
      </nav>
    </div>
  );
};

export { FloatingNav };
