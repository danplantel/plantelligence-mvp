"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { Client } from "../types";

interface DocumentsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  clientFilter: string;
  onClientFilterChange: (value: string) => void;
  clients: Client[];
}

export function DocumentsFilters({
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  clientFilter,
  onClientFilterChange,
  clients,
}: DocumentsFiltersProps) {
  return (
    <div className="flex items-center space-x-4 mb-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search documents, files, or clients..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <Select value={typeFilter} onValueChange={onTypeFilterChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="SPD">SPD Documents</SelectItem>
          <SelectItem value="SBC">SBC Documents</SelectItem>
          <SelectItem value="Summary">Summary Documents</SelectItem>
        </SelectContent>
      </Select>
      <Select value={clientFilter} onValueChange={onClientFilterChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All Clients" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Clients</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.companyName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
