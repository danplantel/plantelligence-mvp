"use client";

import { Button } from "@/components/ui/button";
import { Calendar, Home, FileText, Users, ChevronDown } from "lucide-react";

export function TopBar() {
  return (
    <div className="bg-white border-b">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <div className="flex justify-center items-center bg-gray-200 rounded w-12 h-12">
              <span className="font-bold text-gray-600">LOGO</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-xl">Company Name</h1>
              <p className="text-gray-600 text-sm">Benefits Portal</p>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-1 text-blue-600">
              <Home className="w-4 h-4" />
              <span className="font-medium">Home</span>
            </div>
            <div className="flex items-center space-x-1 text-gray-700 hover:text-gray-900 cursor-pointer">
              <FileText className="w-4 h-4" />
              <span>Your Benefits</span>
              <ChevronDown className="ml-1 w-3 h-3" />
            </div>
            <div className="flex items-center space-x-1 text-gray-700 hover:text-gray-900 cursor-pointer">
              <Users className="w-4 h-4" />
              <span>Access & Materials</span>
              <ChevronDown className="ml-1 w-3 h-3" />
            </div>
          </div>
          
          {/* Button */}
          <Button 
            size="sm" 
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <Calendar className="mr-2 w-4 h-4" />
            Schedule Appointment
          </Button>
        </div>
      </div>
    </div>
  );
}
