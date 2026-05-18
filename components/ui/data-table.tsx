"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ReactPaginate from 'react-paginate';
import { Button } from "./button";
import { Input } from "./input";
import { ScrollArea, ScrollBar } from "./scroll-area";

interface DataTableProps {
  columns: any[];
  data: any[];
  dataTables: any[];
  searchKey?: string;
  currentPdfPlanSpecs: any;
  itemOffset: number;
  endOffset: number;
  handlePageClick: (event: {
    selected: number;
  }) => void;
  pageCount: number;
}

export function DataTable({
  columns,
  data,
  searchKey,
  currentPdfPlanSpecs,
  itemOffset,
  endOffset,
  handlePageClick,
  pageCount,
  dataTables
}: DataTableProps) {


  const table = useReactTable({
    data: data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Simulate fetching items from another resources.
  // (This could be items from props; or items loaded in a local state
  // from an API endpoint with useEffect and useState)

  return (
    <>
      {searchKey && (
        <Input
          placeholder={`Search ${searchKey}...`}
          value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn(searchKey)?.setFilterValue(event.target.value)
          }
          className="w-full md:max-w-sm"
        />
      )}
      <ScrollArea className="border h-[calc(80vh-220px)] bg-white">
        <Table ref={currentPdfPlanSpecs} className="relative text-[10px] sm:text-[12px] md:text-[14px] lg:text-[16px] ">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}
                      className="text-black dark:text-white bg-white dark:bg-black"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="text-black" >
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-black dark:text-white bg-white dark:bg-black">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* <Table ref={currentPdfPlanSpecs} className="relative invisible">
          <TableHeader>
            {tablePdf.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="text-black" >
            {tablePdf.getRowModel().rows?.length ? (
              tablePdf.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),

                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table> */}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <div className="flex items-center justify-between flex-col md:!flex-row  space-x-2 py-4 text-[#7A7A7A]">
        <div className="text-[14px] flex">
          <p>Showing {itemOffset + 1} to {endOffset} of {endOffset} entries</p>
        </div>
        <ReactPaginate
          breakLabel="..."
          className="flex justify-end text-center items-center gap-[8px]"
          activeClassName="w-[32px] h-[32px] flex items-center justify-center text-black dark:text-white"
          pageClassName={"text-[14px]"}
          nextLabel={
            <Button
              variant="outline"
              size="sm"
              className="text-[14px]"
              disabled={itemOffset === pageCount}
            >
              Next
            </Button>
          }
          onPageChange={handlePageClick}
          pageRangeDisplayed={5}
          pageCount={pageCount}
          previousLabel={
            <Button
              variant="outline"
              size="sm"
              className="text-[14px]"
              disabled={itemOffset === 0}
            >
              Previous
            </Button>
          }
          renderOnZeroPageCount={null}
        />
      </div>
    </>
  );
}
