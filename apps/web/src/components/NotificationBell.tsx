import { api } from "@echo/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Bell, BellOff, ShoppingCart } from "lucide-react";

import { useNavigate } from "@tanstack/react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

export function NotificationBell() {
  const navigate = useNavigate();
  const unreadCount = useQuery(api.notifications.unreadCount);
  const notifications = useQuery(api.notifications.list, { limit: 10 });
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const handleNotificationClick = async (notification: NonNullable<typeof notifications>[number]) => {
    if (!notification.read) {
      await markRead({ notificationId: notification._id });
    }
    navigate({
      to: "/conversations/$conversationId",
      params: { conversationId: notification.conversationId },
    });
  };

  const handleMarkAllRead = async () => {
    await markAllRead({});
  };

  const getNotificationIcon = (type: "escalation" | "new_order") => {
    if (type === "escalation") {
      return <AlertCircle className="size-4 shrink-0 text-amber-500" />;
    }
    return <ShoppingCart className="size-4 shrink-0 text-emerald-500" />;
  };

  const getNotificationMessage = (type: "escalation" | "new_order") => {
    if (type === "escalation") {
      return "Escalation: Customer needs help";
    }
    return "New order received";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}
      >
        <Bell className="size-4" />
        {unreadCount !== undefined && unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1",
              "flex h-[18px] min-w-[18px] items-center justify-center",
              "rounded-full bg-red-500 px-1 text-xs font-medium text-white"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount !== undefined && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleMarkAllRead}
                className="h-auto py-0 px-1 text-xs font-normal text-muted-foreground hover:text-foreground"
              >
                Mark all as read
              </Button>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {notifications === undefined ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <BellOff className="size-8 opacity-50" />
            <span className="text-sm">No notifications</span>
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification._id}
              onClick={() => handleNotificationClick(notification)}
              className={cn(
                "flex cursor-pointer items-start gap-3 py-3",
                !notification.read && "bg-accent/50"
              )}
            >
              {getNotificationIcon(notification.type)}
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                <span
                  className={cn(
                    "truncate text-sm",
                    !notification.read && "font-medium"
                  )}
                >
                  {getNotificationMessage(notification.type)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                </span>
              </div>
              {!notification.read && (
                <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-500" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
