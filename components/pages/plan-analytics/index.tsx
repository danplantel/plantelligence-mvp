"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { videos } from "@/constants/data";
import React, { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { DataTable } from "@/components/ui/data-table";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import CsvDownloader from "react-csv-downloader";
import { useParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ReactPaginate from "react-paginate";
import axios from "axios";
import dayjs from "dayjs";
import { IPlan } from "@/types/schema";
import { CalendarDateRangePicker } from "@/components/date-range-picker";

interface DataTable {
  planName: string;
  videoType: string;
  pageViews: number;
  videoPlays: number;
  videoCompletes: number;
  uniqueVisitors: number;
  date?: string;
  planId?: string;
}

interface Column {
  accessorKey: keyof DataTable;
  header: string;
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

const columns = [
  { header: "PLAN NAME", key: "planName" },
  { header: "VIDEO TYPE", key: "videoType" },
  { header: "PAGE VIEWS", key: "pageViews" },
  { header: "VIDEO PLAYS", key: "videoPlays" },
  { header: "VIDEO COMPLETES", key: "videoCompletes" },
  { header: "UNIQUE VISITORS", key: "uniqueVisitors" },
];

const userTypes = [
  { id: "1", name: "User Type 1" },
  // { id: "2", name: "User Type 2" },
  // { id: "3", name: "User Type 3" },
];

const options = {
  responsive: true,
  scales: {
    x: {
      grid: {
        color: "#808080",
      },
    },
    y: {
      grid: {
        color: "#808080",
      },
    },
  },
  plugins: {
    legend: {
      position: "bottom" as const,
    },
    title: {
      display: false,
    },
  },
};

interface PlanAnalyticsProps {
  planId?: string;
}

const PlanAnalytics = ({ planId: propPlanId }: PlanAnalyticsProps) => {
  const router = useRouter();

  const lineChartRef = useRef<ChartJS<"line", number[], string>>(null);
  const tableRef = useRef(null);

  const [planAnalytic, setAnalytic] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>(videos);
  const [filter, setFilter] = useState({
    planId: propPlanId,
    startDate: dayjs().subtract(30, "d").startOf("day").toISOString(),
    endDate: dayjs().startOf("day").toISOString(),
  });

  const dataTablesDefault = plans.map((plan) => ({
    planName: plan.clientName,
    planId: plan.videoId,
    videoType: "Plan Video",
    pageViews: plan.analytics?.[0]?.pageViews || 0,
    videoPlays: plan.analytics?.[0]?.videoPlays || 0,
    videoCompletes: plan.analytics?.[0]?.videoCompletes || 0,
    uniqueVisitors: plan.analytics?.[0]?.uniqueVisitors || 0,
    date: plan.analytics?.[0]?.date,
  }));

  const data = {
    labels: planAnalytic?.map((item) => item?.date) || [],
    datasets: [
      {
        label: "Page Views",
        data: planAnalytic?.map((item) => item?.pageView) || [],
        borderColor: "rgb(53, 162, 235)",
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
      {
        label: "Video Plays",
        data: planAnalytic?.map((item) => item?.videoPlay) || [],
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
      },
      {
        label: "Video Completions",
        data: planAnalytic?.map((item) => item?.videoComplete) || [],
        borderColor: "rgb(241 120 25)",
        backgroundColor: "rgba(241, 120, 25, 0.5)",
      },
      {
        label: "Unique Visitors",
        data: planAnalytic?.map((item) => item?.uniqueVisitor) || [],
        borderColor: "rgb(213 235 53)",
        backgroundColor: "rgba(213, 235, 53, 0.5)",
      },
    ],
  };

  const [itemOffset, setItemOffset] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const endOffset = itemOffset + itemsPerPage;

  const planDisplayed = plans
    ?.filter((item) => (propPlanId ? item.videoId === propPlanId : true))
    .slice(itemOffset, endOffset);

  const pageCount = Math.ceil((planDisplayed?.length || 0) / itemsPerPage);

  const handlePageClick = (event: { selected: number }) => {
    const newOffset = (event.selected * itemsPerPage) % planDisplayed.length;
    setItemOffset(newOffset);
  };

  const [isRender, setIsRender] = useState(false);

  const handleGeneratePdf = async () => {
    setItemsPerPage(planDisplayed.length);
    setIsRender(true);
    setItemOffset(0);
  };

  const generatePdf = async () => {
    const chartRef = lineChartRef.current;
    const dataTableRef = tableRef.current;

    try {
      if (chartRef == null || dataTableRef == null) {
        setIsRender(false);
        setItemsPerPage(10);
        return;
      }

      const imgData = chartRef.toBase64Image("image/jpeg", 1);
      const canvasTable = await html2canvas(dataTableRef);
      canvasTable.getContext("2d", {
        willReadFrequently: true,
      });

      const canvas = document.createElement("img");
      canvas.setAttribute("src", imgData);

      setTimeout(() => {
        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        const doc = new jsPDF("p", "mm");
        let position = 0;

        doc.addImage(imgData, "PNG", 2, position, imgWidth - 4, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position += heightLeft - imgHeight;
          doc.addPage();
          doc.addImage(imgData, "PNG", 2, position, imgWidth - 4, imgHeight);
          heightLeft -= pageHeight;
        }

        const imgTable = canvasTable.toDataURL("image/png");
        let imgHeightTable =
          (canvasTable.height * imgWidth) / canvasTable.width;
        let pageHeightLeft = pageHeight - imgHeight;
        let heightTableLeft = imgHeightTable - pageHeightLeft;

        doc.addImage(
          imgTable,
          "PNG",
          2,
          imgHeight,
          imgWidth - 4,
          imgHeightTable,
        );
        // imgHeightTable = pageHeight - imgHeight;

        while (heightTableLeft >= 0) {
          position += pageHeightLeft;
          doc.addPage();
          doc.addImage(
            imgTable,
            "PNG",
            2,
            -1 * position,
            imgWidth - 4,
            imgHeightTable,
          );
          pageHeightLeft = pageHeight;
          heightTableLeft -= pageHeight;
        }

        doc.save("Plan Analytics.pdf");
        setIsRender(false);
        setItemsPerPage(10);
      }, 0);
    } catch (error) {
      setIsRender(false);
      setItemsPerPage(10);
    }
  };

  useEffect(() => {
    if (isRender) {
      generatePdf();
    }
  }, [isRender, itemsPerPage]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axios.get("/api/plans/get-list-plan");
        if (response.data?.data) {
          setPlans(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    const fetchPlanAnalytic = async () => {
      try {
        const response = await axios.get("/api/plans/get-plan-analytic", {
          params: filter,
        });
        if (response.data?.data) {
          setAnalytic(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
      }
    };
    fetchPlanAnalytic();
  }, [filter]);

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    setFilter((prev) => ({
      ...prev,
      startDate: dayjs(range.from).startOf("day").toISOString(),
      endDate: dayjs(range.to).endOf("day").toISOString(),
    }));
  };

  return (
    <div>
      <div className="flex gap-[12px] flex-wrap">
        <div className="flex flex-col gap-[8px] w-auto">
          <p>Filter By Plans</p>
          <Select
            value={filter.planId}
            onValueChange={(i) =>
              i === "all"
                ? router.push(`/plan-analytics`)
                : router.push(`/plan-analytics/${i}`)
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue
                placeholder={`All Plans (${plans.length})`}
              ></SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem key={"all"} value={"all"}>
                {`All Plans (${plans.length})`}
              </SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan.videoId} value={plan.videoId || ""}>
                  {plan.clientName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-[8px] w-auto">
          <p>Video Filter</p>
          <Select
            value={filter.planId}
            onValueChange={(i) =>
              i === "all"
                ? router.push(`/plan-analytics`)
                : router.push(`/plan-analytics/${i}`)
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Videos" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.videoId} value={plan.videoId || ""}>
                  {(plan as any).video?.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-[8px] w-auto">
          <p>Date Range</p>
          <div className="flex items-center space-x-4">
            <CalendarDateRangePicker
              className="w-[300px]"
              onDateRangeChange={handleDateRangeChange}
              defaultDate={{
                from: dayjs(filter.startDate).toDate(),
                to: dayjs(filter.endDate).toDate(),
              }}
            />
            <Select
              value={filter.planId}
              onValueChange={(i) =>
                i === "all"
                  ? router.push(`/plan-analytics`)
                  : router.push(`/plan-analytics/${i}`)
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {userTypes.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-end">
          <Button>Update</Button>
        </div>
      </div>
      <div className="mt-[24px] w-full flex justify-center">
        <Line
          className=" w-full md:max-w-[100%]"
          ref={lineChartRef}
          options={options}
          data={data}
        />
      </div>

      <div className="grid grid-cols-2 rounded-sm w-fit mt-[12px]">
        <CsvDownloader
          datas={plans.map((data) => ({
            planName: data.clientName?.toString(),
            videoType: "Plan Video",
            pageViews: data.pageView?.toString(),
            videoPlays: data.videoPlay?.toString(),
            videoCompletes: data.videoComplete?.toString(),
            uniqueVisitors: data.uniqueVisitor?.toString(),
          }))}
          filename="Plan Analytics.csv"
          columns={columns.map((col) => {
            return {
              id: col.key,
              displayName: col.header,
            };
          })}
        >
          <Button
            className={`border-r rounded-none rounded-l-[20px] border border-solid border-black dark:border-white text-black dark:text-white bg-white dark:bg-black`}
          >
            CSV
          </Button>
        </CsvDownloader>
        <Button
          className={`rounded-none rounded-r-[20px] -ml-6 border border-solid border-black dark:border-white text-black dark:text-white bg-white dark:bg-black`}
          onClick={() => handleGeneratePdf()}
        >
          PDF Export
        </Button>
      </div>
      <div className="mt-[20px]">
        <Table ref={tableRef}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className="text-sm font-normal text-blue-500 underline bg-white dark:bg-black"
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {planDisplayed.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="text-black bg-white dark:text-white dark:bg-black">
                  {item.clientName}
                </TableCell>
                <TableCell className="text-black bg-white dark:text-white dark:bg-black">
                  Plan Video
                </TableCell>
                <TableCell className="text-black bg-white dark:text-white dark:bg-black">
                  {item.pageView || 0}
                </TableCell>
                <TableCell className="text-black bg-white dark:text-white dark:bg-black">
                  {item.videoPlay || 0}
                </TableCell>
                <TableCell className="text-black bg-white dark:text-white dark:bg-black">
                  {item.videoComplete || 0}
                </TableCell>
                <TableCell className="text-black bg-white dark:text-white dark:bg-black">
                  {item.uniqueVisitor || 0}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between flex-col md:!flex-row  space-x-2 py-4 text-[#7A7A7A]">
          <div className="text-[14px] flex">
            <p>
              Showing {itemOffset + 1} to {endOffset} of {endOffset} entries
            </p>
          </div>
          <ReactPaginate
            breakLabel="..."
            className="flex justify-end text-center items-center gap-[8px]"
            activeClassName="w-[32px] h-[32px] flex items-center justify-center text-black dark:text-white bg-primary text-primary-foreground shadow hover:bg-primary/90 rounded-md"
            pageClassName={"text-[14px]"}
            nextLabel={
              <Button
                variant="outline"
                size="sm"
                className="text-[14px]"
                disabled={Math.ceil(endOffset / itemsPerPage) === pageCount}
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
      </div>
    </div>
  );
};

export default PlanAnalytics;
