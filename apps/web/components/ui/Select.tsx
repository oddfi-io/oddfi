"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon } from "@phosphor-icons/react";
import CaretDownIcon from "@/components/icons/CaretDownIcon";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      // H5 (Figma 816:63111): h-[28px] rounded-8 pl-[12px] pr-[8px], text-[12px] regular
      // PC: h-10 rounded-12 pl-4 pr-3, text-xs medium
      "flex h-[28px] lg:h-10 items-center gap-1 rounded-8 lg:rounded-12",
      "bg-[#111114] lg:bg-fill-input border border-[#212124] lg:border-transparent",
      "pl-[12px] lg:pl-4 pr-[8px] lg:pr-3 py-[6px] lg:py-[11px]",
      "text-[12px] lg:text-xs font-medium text-white lg:text-primary backdrop-blur-[15px]",
      "outline-none transition-colors",
      "hover:bg-white/[0.08] data-[state=open]:bg-white/[0.08]",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <span className="shrink-0">
        <CaretDownIcon size={12} className="text-white lg:hidden" />
        <CaretDownIcon size={14} className="text-primary hidden lg:block" />
      </span>
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-12",
        "bg-fill-dropdown border border-border-divider shadow-modal",
        "animate-in fade-in-0 zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      sideOffset={4}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-8",
      "py-2 pl-3 pr-8 text-xs text-secondary outline-none",
      "hover:bg-white/[0.06] hover:text-primary",
      "focus:bg-white/[0.06] focus:text-primary",
      "data-[state=checked]:text-primary",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon size={12} className="text-fn-brand" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
