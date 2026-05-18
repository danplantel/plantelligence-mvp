"use client"

import { TableCell, TableRow } from "@/components/ui/table"

export function SkeletonTableRow() {
  return (
    <TableRow>
      <TableCell className="min-w-[300px]">
        <div className="flex items-center justify-start gap-2">
          <div className="h-[46px] w-[46px] rounded-[8px] bg-transparent dark:bg-transparent flex items-center justify-center animate-pulse">
            <div className="h-[28px] w-[28px] rounded-[8px] bg-neutral-300 dark:bg-neutral-600"></div>
          </div>
          <div className="w-[180px] bg-neutral-200 dark:bg-neutral-700 rounded-[4px] h-[16px] animate-pulse"></div>
        </div>
      </TableCell>
      <TableCell>
        <div className="w-[60px] bg-neutral-200 dark:bg-neutral-700 rounded-[4px] h-[16px] animate-pulse"></div>
      </TableCell>
      <TableCell>
        <div className="w-[80px] bg-neutral-200 dark:bg-neutral-700 rounded-[4px] h-[16px] animate-pulse"></div>
      </TableCell>
      <TableCell>
        <div className="w-[120px] bg-neutral-200 dark:bg-neutral-700 rounded-[4px] h-[16px] animate-pulse"></div>
      </TableCell>
      <TableCell className="w-[50px]">
        <div className="w-[20px] h-[20px] mx-auto bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse"></div>
      </TableCell>
    </TableRow>
  )
}

