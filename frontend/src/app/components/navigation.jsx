"use client";

import { ModeToggle } from "@/components/theme-changer";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { GraduationCap as Graduation, HelpCircle, Home, Info, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/about", label: "About", icon: Info },
  { href: "/contact", label: "Contact", icon: Mail },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <NavigationMenu className="max-w-full w-full justify-between px-4 py-2 bg-card">
      <NavigationMenuList>
        <NavigationMenuItem className="flex items-center gap-2 mr-8">
          <Graduation className="h-6 w-6" />
          <span className="font-bold text-lg">CO-PO Mapping Generator</span>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuList>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavigationMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <NavigationMenuLink
                  className={cn(
                    "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
                    pathname === item.href && "bg-accent/50"
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </NavigationMenuLink>
              </Link>
             
            </NavigationMenuItem>
          );
        })}
         <ModeToggle />
      </NavigationMenuList>
    </NavigationMenu>
  );
}