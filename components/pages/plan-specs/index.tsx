"use client";
import React, { useRef } from "react";
import { useParams } from "next/navigation";
import { videos } from "@/constants/data";
import { FileDownIcon } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { PlanSpecsDetail } from "./PlanSpecsDetail";

const PlanSpecs = () => {
  const params = useParams();
  const id = params?.id;
  const currentPdfPlanSpecs = useRef(null);
  const currentVideo = videos.find((item) => item.videoId === id);

  const handleGeneratePdf = async () => {
    const inputData = currentPdfPlanSpecs.current;
    try {
      if (!inputData) {
        return;
      }
      const canvas = await html2canvas(inputData);
      var imgData = canvas.toDataURL("image/png");
      var imgWidth = 210;
      var pageHeight = 295;
      var imgHeight = (canvas.height * imgWidth) / canvas.width;
      var heightLeft = imgHeight;
      var doc = new jsPDF("p", "mm");
      var position = 0;

      doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position += heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      doc.save("file.pdf");
    } catch (error) {
      console.error("error", error);
    }
  };

  return (
    <div className="w-full max-w-[1200px] px-2">
      <div ref={currentPdfPlanSpecs}>
        <PlanSpecsDetail id={id} currentVideo={currentVideo} />
      </div>
      <div className="mt-8 mb-4 text-[#959595]">
        <p className="text-[12px]">
          Information has been obtained from sources believed to be reliable and
          up-to-date, but is not guaranteed as to accuracy. For more details,
          please refer to the Summary Plan Description.
        </p>
      </div>
      <div className="w-full py-[12px]">
        <div
          className="flex flex-row items-center hover:cursor-pointer"
          onClick={() => handleGeneratePdf()}
        >
          <FileDownIcon color="#027D99" className="w-4 mr-1"></FileDownIcon>
          <p className="text-[#027D99] underline text-[12px]">
            Download as PDF
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlanSpecs;
