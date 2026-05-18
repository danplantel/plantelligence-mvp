"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  MoreHorizontal,
  Download,
  Eye,
  Trash2,
  FileText,
  Calendar,
  HardDrive,
} from "lucide-react";
import { formNow } from "@/lib/date";

interface Document {
  id: string;
  name: string;
  type: string;
  clientId: string;
  clientName: string;
  uploadDate: string;
  expiration: string;
  size: string;
  status: string;
  fileData?: string;
}

export function DocumentsListDashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<keyof Document>("uploadDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleGetDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDocuments(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGetDocuments();
  }, []);

  const handleSort = (field: keyof Document) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedDocuments = [...documents].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue == null || bValue == null) return 0;
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "SPD":
        return <FileText className="h-4 w-4 text-blue-600" />;
      case "SBC":
        return <FileText className="h-4 w-4 text-green-600" />;
      case "Optional":
        return <FileText className="h-4 w-4 text-gray-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 hover:bg-green-100"
          >
            Active
          </Badge>
        );
      case "Expired":
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleDownload = (doc: Document) => {
    if (doc.fileData) {
      const link = document.createElement("a");
      link.href = doc.fileData;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleView = (doc: Document) => {
    if (doc.fileData) {
      window.open(doc.fileData, "_blank");
    }
  };

  const handleDelete = (documentId: string) => {};

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span>Loading documents...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">All Documents</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={handleGetDocuments} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px] py-4">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("name")}
                    className="h-auto p-0 font-semibold"
                  >
                    Document
                    <MoreHorizontal className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="py-4">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("type")}
                    className="h-auto p-0 font-semibold"
                  >
                    Type
                    <MoreHorizontal className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="py-4">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("clientName")}
                    className="h-auto p-0 font-semibold"
                  >
                    Client
                    <MoreHorizontal className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="py-4">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("uploadDate")}
                    className="h-auto p-0 font-semibold"
                  >
                    Upload Date
                    <MoreHorizontal className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="py-4">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("expiration")}
                    className="h-auto p-0 font-semibold"
                  >
                    Expiration
                    <MoreHorizontal className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="py-4">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("size")}
                    className="h-auto p-0 font-semibold"
                  >
                    Size
                    <MoreHorizontal className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="py-4">Status</TableHead>
                <TableHead className="w-[70px] py-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDocuments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No documents found
                  </TableCell>
                </TableRow>
              ) : (
                sortedDocuments.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="font-medium py-4">
                      <div className="flex items-center space-x-3">
                        {getTypeIcon(document.type)}
                        <div>
                          <div className="font-medium">{document.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline">{document.type}</Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="font-medium">{document.clientName}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-4">
                      {formNow(document.uploadDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {document.expiration}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-4">
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {document.size}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {getStatusBadge(document.status)}
                    </TableCell>
                    <TableCell className="py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => handleView(document)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDownload(document)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(document.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
