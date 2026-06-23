import { useLocation } from "wouter";
import { LogOut, Settings, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Signed-in attorney menu. Email/password accounts have no name or avatar, so
// the trigger shows the email's first initial and the menu surfaces the email
// plus sign-out.
export function UserMenu() {
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const email = user?.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "A";

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Account menu"
          className="h-9 w-9 rounded-full p-0 hover:bg-muted"
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-sm font-medium text-primary-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-muted-foreground">
            Signed in as
          </span>
          <span className="block truncate text-sm font-medium text-foreground">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/dashboard")}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4" />
          My listings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate("/account")}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
