import { Icons } from "@/components/icons";

export type NavItem = {
  title: string;
  href?: string;
  icon?: keyof typeof Icons;
  label?: string;
  items?: {
    title: string;
    href?: string;
    icon?: keyof typeof Icons;
    label?: string;
  }[];
};

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

export interface NavItemWithOptionalChildren extends NavItem {
  items?: NavItemWithChildren[];
}

export interface FooterItem {
  title: string;
  items: {
    title: string;
    href: string;
    external?: boolean;
  }[];
}

export type MainNavItem = NavItemWithOptionalChildren;

export type SidebarNavItem = NavItemWithChildren;
