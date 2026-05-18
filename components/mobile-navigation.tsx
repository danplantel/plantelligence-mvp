"use client";

import { useState } from "react";
import { Menu, X, Home, FileText, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden right-4 bottom-4 z-50 fixed">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg rounded-full w-14 h-14 text-white"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="lg:hidden z-40 fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsOpen(false)}>
          <div className="right-0 bottom-0 left-0 fixed bg-white p-6 rounded-t-lg">
            <div className="space-y-4">
              <div className="flex items-center space-x-3 hover:bg-gray-50 p-3 rounded-lg">
                <Home className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Home</span>
              </div>
              <div className="flex items-center space-x-3 hover:bg-gray-50 p-3 rounded-lg">
                <FileText className="w-5 h-5 text-gray-600" />
                <span>Your Benefits</span>
              </div>
              <div className="flex items-center space-x-3 hover:bg-gray-50 p-3 rounded-lg">
                <Users className="w-5 h-5 text-gray-600" />
                <span>Access & Materials</span>
              </div>
              <div className="pt-4 border-t">
                <Button className="bg-yellow-500 hover:bg-yellow-600 w-full text-black">
                  <Calendar className="mr-2 w-4 h-4" />
                  Schedule Appointment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
