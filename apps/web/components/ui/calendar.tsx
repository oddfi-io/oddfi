"use client";

import { DayPicker } from "react-day-picker";
import type { ComponentProps } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type CalendarProps = ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // Nav is rendered as first child of months (before month divs) in rdp v9 default layout.
        // We make months relative and position nav absolutely across its full width.
        months: "relative flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center items-center h-9",
        caption_label: "text-sm font-medium",
        nav: "absolute top-0 left-0 right-0 h-9 flex items-center justify-between px-1",
        button_previous: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          "inline-flex items-center justify-center rounded-md border border-input",
          "hover:bg-accent hover:text-accent-foreground"
        ),
        button_next: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          "inline-flex items-center justify-center rounded-md border border-input",
          "hover:bg-accent hover:text-accent-foreground"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] flex items-center justify-center",
        week: "flex w-full mt-2",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-accent",
          "[&:has([aria-selected].day-outside)]:bg-accent/50",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md"
        ),
        day_button: cn(
          "h-8 w-8 p-0 font-normal rounded-md",
          "inline-flex items-center justify-center text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "aria-selected:opacity-100",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        ),
        range_start: "day-range-start rounded-l-md",
        range_end: "day-range-end rounded-r-md",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <CaretLeftIcon size={14} /> : <CaretRightIcon size={14} />,
      }}
      {...props}
    />
  );
}
