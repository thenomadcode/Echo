import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useState } from "react";

import { useSidebar } from "@/components/layout/SidebarContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/conversations", label: "Conversations", icon: MessageSquare },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/products", label: "Products", icon: Package },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = !isCollapsed || isHovered;

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 border-r bg-background transition-[width] duration-200 ease-in-out",
        isExpanded ? "lg:w-60" : "lg:w-16"
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          E
        </div>
        <span
          className={cn(
            "text-xl font-bold font-heading whitespace-nowrap overflow-hidden transition-opacity duration-200",
            isExpanded ? "opacity-100" : "opacity-0"
          )}
        >
          Echo
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentPath === item.to || currentPath.startsWith(`${item.to}/`);

          const linkContent = (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap overflow-hidden transition-opacity duration-200",
                  isExpanded ? "opacity-100" : "opacity-0 w-0"
                )}
              >
                {item.label}
              </span>
            </Link>
          );

          if (!isExpanded) {
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger render={<span className="block" />}>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      <div className="border-t p-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={cn(
                  "flex w-full items-center justify-start gap-3 h-auto rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground"
                )}
              />
            }
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5 shrink-0" />
            ) : (
              <ChevronLeft className="h-5 w-5 shrink-0" />
            )}
            <span
              className={cn(
                "whitespace-nowrap overflow-hidden transition-opacity duration-200",
                isExpanded ? "opacity-100" : "opacity-0 w-0"
              )}
            >
              {isCollapsed ? "Expand" : "Collapse"}
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
