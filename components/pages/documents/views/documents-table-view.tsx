"use client";

import type { MouseEvent, ReactNode } from "react";
import { formatUsDate, formatUsTime } from "@/lib/date";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

import { getDocumentCategoryDisplayLabel } from "@/lib/service-categories";
import {
  FileText,
  Download,
  Eye,
  MoreHorizontal,
  ChevronsUpDown,
  Calendar,
  Building,
  Edit2,
  Trash2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Document, SortColumn, SortDirection } from "../types";

interface DocumentsTableViewProps {
  documents: Document[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  onPreview: (documentId: string, title: string) => void;
  onDownload: (documentId: string, fileName: string) => void;
  onDelete: (documentId: string, title: string) => void;
  getDocumentType: (doc: Document) => string;
  onEdit?: (documentId: string, title: string, updates?: { category?: string }) => void;
  availableCategories?: string[]; // Optional prop for passing categories (values; display uses Settings-style labels)
  /** Compact rows with smaller font sizes (wizard List tab). */
  compact?: boolean;
  /** Hide the upload time, showing only the date. */
  hideUploadedTime?: boolean;
  /** Show tooltips on the quick action buttons. */
  showActionTooltips?: boolean;
  /** Render Edit/Delete as direct buttons instead of the "..." menu. */
  showDirectEditDelete?: boolean;
  /** When true, the Category column renders static badges instead of the editable
   *  Select dropdown, even when `onEdit` is provided. Used in the Create Benefits
   *  flow where the category is already fixed by the benefit being configured. */
  disableCategoryEdit?: boolean;
}

interface ActionButtonProps {
  label: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  icon: ReactNode;
  showTooltip?: boolean;
  destructive?: boolean;
}

/** Quick action icon button with an optional hover tooltip. */
function ActionButton({
  label,
  onClick,
  icon,
  showTooltip = false,
  destructive = false,
}: ActionButtonProps) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`h-8 w-8 p-0 ${
        destructive
          ? "text-red-500 hover:text-red-600 dark:text-red-400"
          : ""
      }`}
    >
      {icon}
    </Button>
  );

  if (!showTooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function DocumentsTableView({
  documents,
  sortColumn,
  sortDirection,
  onSort,
  onPreview,
  onDownload,
  onDelete,
  getDocumentType,
  onEdit,
  availableCategories = [],
  compact = false,
  hideUploadedTime = false,
  showActionTooltips = false,
  showDirectEditDelete = false,
  disableCategoryEdit = false,
}: DocumentsTableViewProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-md border dark:border-gray-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px] p-4">
                <Button
                  variant="ghost"
                  onClick={() => onSort("title")}
                  className="h-auto p-0 font-semibold"
                >
                  Document Title
                  <ChevronsUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="py-4">Category</TableHead>
              {/* <TableHead className="py-4">
              <Button
                variant="ghost"
                onClick={() => onSort("client")}
                className="h-auto p-0 font-semibold"
              >
                Client
                <ChevronsUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead> */}
              <TableHead className="py-4">
                <Button
                  variant="ghost"
                  onClick={() => onSort("uploadedAt")}
                  className="h-auto p-0 font-semibold"
                >
                  Uploaded
                  <ChevronsUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="py-4">
                <Button
                  variant="ghost"
                  onClick={() => onSort("expirationDate")}
                  className="h-auto p-0 font-semibold whitespace-nowrap"
                >
                  Review Date
                  <ChevronsUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>

              <TableHead
                className={`${showDirectEditDelete ? "w-[180px]" : "w-[120px]"} py-4`}
              >
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => {
              const documentType = getDocumentType(document);
              const uploadedDate = formatUsDate(document.uploadedAt);
              const uploadedTime = formatUsTime(document.uploadedAt);

              return (
                <TableRow key={document.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <TableCell className={`font-medium text-gray-900 dark:text-gray-100 ${compact ? "text-sm" : ""}`}>
                    <div className="flex items-center">
                      <FileText className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} mr-2 text-gray-400 dark:text-gray-500`} />
                      {document.title}
                    </div>
                  </TableCell>
                  <TableCell>
                    {onEdit && !disableCategoryEdit ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-[140px] max-w-[240px]"
                      >
                        <Select
                          key={`${document.id}-${document.category ?? ""}`}
                          value={document.category || undefined}
                          onValueChange={(value) =>
                            onEdit(document.id, document.title, {
                              category: value,
                            })
                          }
                        >
                          <SelectTrigger
                            className={`h-9 w-full text-left ${
                              compact ? "text-xs" : "text-sm"
                            } ${
                              !document.category
                                ? "border-amber-200 bg-amber-50/50 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400"
                                : ""
                            }`}
                          >
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCategories.length > 0
                              ? availableCategories.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {getDocumentCategoryDisplayLabel(cat)}
                                  </SelectItem>
                                ))
                              : [
                                  "Retirement",
                                  "Group Health",
                                  "Group Life",
                                  "Other Benefits",
                                ].map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {getDocumentCategoryDisplayLabel(cat)}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : document.category ? (
                      <Badge
                        variant="outline"
                        className="bg-purple-50 text-purple-700 hover:bg-purple-700 hover:text-white border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-800 dark:hover:text-white dark:border-purple-800 cursor-default transition-colors"
                        title={document.category.includes(",") ? document.category : undefined}
                      >
                        {getDocumentCategoryDisplayLabel(document.category)}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-red-50 text-red-600 border-red-100 italic dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                      >
                        Uncategorized
                      </Badge>
                    )}
                  </TableCell>
                  {/* <TableCell>
                  <div className="flex items-center text-sm text-gray-900 dark:text-gray-100">
                    <Building className="h-3 w-3 mr-1 text-gray-400 dark:text-gray-500" />
                    {document.client.companyName}
                  </div>
                </TableCell> */}
                  <TableCell>
                    <div className="space-y-1">
                      <div className={`flex items-center text-gray-900 dark:text-gray-100 ${compact ? "text-xs" : "text-sm"}`}>
                        <Calendar className="h-3 w-3 mr-1 text-gray-400 dark:text-gray-500" />
                        {uploadedDate}
                      </div>
                      {!hideUploadedTime && (
                        <div className={`text-gray-500 dark:text-gray-400 ${compact ? "text-[10px]" : "text-xs"}`}>{uploadedTime}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {document.expirationDate ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span className={`text-gray-900 dark:text-gray-100 ${compact ? "text-xs" : "text-sm"}`}>
                          {formatUsDate(document.expirationDate)}
                        </span>
                        {/* Notification bell — hidden for now; feature will be re-added later. */}
                        {(() => {
                          const expirationDate = new Date(
                            document.expirationDate,
                          );
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          expirationDate.setHours(0, 0, 0, 0);
                          const daysUntilExpiration = Math.ceil(
                            (expirationDate.getTime() - today.getTime()) /
                            (1000 * 60 * 60 * 24),
                          );
                          if (daysUntilExpiration < 0) {
                            return (
                              <Badge
                                variant="destructive"
                                className={`ml-2 ${compact ? "text-[10px]" : "text-xs"}`}
                              >
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Expired
                              </Badge>
                            );
                          } else if (daysUntilExpiration <= 30) {
                            return (
                              <Badge
                                variant="outline"
                                className={`ml-2 border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400 ${compact ? "text-[10px]" : "text-xs"}`}
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                {daysUntilExpiration} day
                                {daysUntilExpiration !== 1 ? "s" : ""} left
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ) : (
                      <span className={`text-gray-400 dark:text-gray-500 ${compact ? "text-xs" : "text-sm"}`}>-</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className={`flex items-center ${showDirectEditDelete ? "space-x-1" : "space-x-2"}`}>
                      <ActionButton
                        label="Preview"
                        showTooltip={showActionTooltips}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreview(document.id, document.title);
                        }}
                        icon={<Eye className="h-4 w-4" />}
                      />
                      <ActionButton
                        label="Download"
                        showTooltip={showActionTooltips}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(document.id, document.fileName);
                        }}
                        icon={<Download className="h-4 w-4" />}
                      />
                      {showDirectEditDelete ? (
                        <>
                          {onEdit && (
                            <ActionButton
                              label="Edit"
                              showTooltip={showActionTooltips}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(document.id, document.title);
                              }}
                              icon={<Edit2 className="h-4 w-4" />}
                            />
                          )}
                          <ActionButton
                            label="Delete"
                            showTooltip={showActionTooltips}
                            destructive
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(document.id, document.title);
                            }}
                            icon={<Trash2 className="h-4 w-4" />}
                          />
                        </>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {onEdit && (
                              <DropdownMenuItem
                                onSelect={() => onEdit(document.id, document.title)}
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit/Update
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onSelect={() => onDelete(document.id, document.title)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
