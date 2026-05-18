"use client";
import React, { Fragment, useRef } from "react";
import Link from "next/link";
import {
    KeyboardIcon,
} from "@radix-ui/react-icons";
import { useParams } from "next/navigation";
import { videos } from "@/constants/data";
import { BookUser, FileDownIcon, LineChart } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface PlanSpecsDetailProps {
    id: string | string[];
    currentVideo: any;
}

export const PlanSpecsDetail = ({id,currentVideo}: PlanSpecsDetailProps ) => {
    const employee_contributions = currentVideo?.items?.employee_contributions;
    const employer_contributions = currentVideo?.items?.employer_contributions;
    const vesting_and_operations = currentVideo?.items?.vesting_and_operations;
    return (
        <div>
        <div  className="flex justify-between items-center mb-[18px] md:!flex-row flex-col">
            <p className="font-semibold tracking-tight text-[22px]">
                {currentVideo?.items?.title}
            </p>
            <img
                src={
                    currentVideo?.items?.image ||
                    "https://img.freepik.com/free-photo/education-day-arrangement-table-with-copy-space_23-2148721266.jpg"
                }
                alt="Waypoint Financial"
                className="w-[80px] object-cover"
            />

        </div>
        <div className="flex flex-col items-center justify-center">
            <div
                className={`flex items-center gap-[4px] px-[8px] py-[8px] text-white w-full`}
                style={{ backgroundColor: currentVideo?.clientColor }}
            >
                <BookUser className="w-[16px] h-[16px] text-white" />
                <span className="text-[12px] text-white font-semibold">
                    PLAN CONTACTS
                </span>
            </div>
            <div className="w-full px-4 flex md:items-center justify-between mt-[8px] mb-[8px] flex-col md:!flex-row items-start gap-[12px]">
                {(currentVideo?.items?.data || []).map((item:any, index:any) => {
                    const Icon = item?.icon || Fragment;
                    return (
                        <div
                            key={index}
                            className="flex flex-col w-full border-[1px] border-solid border-t rounded-[4px] overflow-hidden h-full"
                        >
                            <div
                                className={`flex items-center pl-2 gap-[4px] px-[8px] py-[8px] text-white`}
                                style={{ backgroundColor: currentVideo?.clientColor }}
                            >
                                {<Icon className="w-[16px] h-[16px] text-white" /> || (
                                    <KeyboardIcon className="w-[16px] h-[16px] text-white" />
                                )}
                                <span className="text-[12px] text-white font-semibold underline uppercase">
                                    {item.title}
                                </span>
                            </div>
                            <div className="pt-[8px] p-[8px]">
                                <span className="text-[16px] font-semibold mt-[12px]">
                                    {item.subTitle}
                                </span>
                                {item.email && (
                                    <Link href={`mailto:${item.email}`}>
                                        <div className="flex items-center gap-[4px] mt-[4px] text-[#027D99]">
                                            <span className="text-[14px]">{item.email}</span>
                                        </div>
                                    </Link>
                                )}
                                {item.website && (
                                    <Link href={item.website} target="_blank">
                                        <div className="flex items-center gap-[4px] mt-[4px]">
                                            <span className="text-[14px] truncate text-[#027D99]">
                                                {item.website}
                                            </span>
                                        </div>
                                    </Link>
                                )}
                                <div className="flex items-center gap-[4px] mt-[4px] text-[#027D99]">
                                    <span className="text-[14px]">{item.phone}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
        <div className="flex flex-col justify-center">
            <div
                className={`flex items-center gap-[4px] px-[8px] py-[8px] text-white w-full`}
                style={{ backgroundColor: currentVideo?.clientColor }}
            >
                <img src='/eligibity.png' className="w-[16px] h-[16px]" />
                <span className="text-[12px] text-white font-semibold">
                    ELIGIBITY
                </span>
            </div>
            <span className=" font-semibold my-[12px]">Waiting Period: <span className="font-normal">{currentVideo?.items?.eligibility?.waiting_period}</span></span>
        </div>
        <div className="flex flex-col items-center justify-center">
            <div
                className={`flex items-center gap-[4px] px-[8px] py-[8px] text-white w-full`}
                style={{ backgroundColor: currentVideo?.clientColor }}
            >
                <img src='/hand.png' className="w-[16px] h-[16px]" />
                <span className="text-[12px] text-white font-semibold">
                    EMPLOYEE CONTRIBUTIONS
                </span>
            </div>
            <div className="w-full flex md:items-center justify-between my-[4px] flex-col md:!flex-row items-start gap-[12px]">
                <div className="flex-col flex gap-[2px]">
                    {employee_contributions?.auto_enrollment && <span className="font-semibold">Auto Enrollment: <span className="font-normal">{employee_contributions?.auto_enrollment}</span></span>}
                    {employee_contributions?.auto_increase && <span className="font-semibold">Auto Increase: <span className="font-normal">{employee_contributions?.auto_increase}</span></span>}
                    {employee_contributions?.mandatory_contributions && <span className="font-semibold">Mandatory Contributions: <span className="font-normal">{employee_contributions?.mandatory_contributions}</span></span>}
                </div>
                <div className="flex flex-col items-start md:items-end">
                    {employee_contributions?.safe_harbor && <span className="font-semibold">Safe Harbor: <span className="font-normal">{employee_contributions?.safe_harbor}</span></span>}
                    {employee_contributions?.after_tax_contributions && <span className="font-semibold">After Tax Contributions: <span className="font-normal">{employee_contributions?.after_tax_contributions}</span></span>}
                    {employee_contributions?.roth_contributions && <span className="font-semibold">Roth Contributions: <span className="font-normal">{employee_contributions?.roth_contributions}</span></span>}
                </div>
            </div>
        </div>
        <div className="flex flex-col">
            <div
                className={`flex items-center gap-[4px] px-[8px] py-[8px] text-white w-full`}
                style={{ backgroundColor: currentVideo?.clientColor }}
            >
                <img src='/contributions.png' className="w-[16px] h-[16px]" />
                <span className="text-[12px] text-white font-semibold">
                    EMPLOYER CONTRIBUTIONS
                </span>
            </div>
            <div className="w-full my-[4px] gap-[2px] flex justify-between flex-col items-start]">
                
                {employer_contributions?.match && <span className="font-semibold">Match: <span className="font-normal">{employer_contributions?.match}</span></span>}
                {employer_contributions?.waiting_period && <span className="font-semibold">Waiting Period: <span className="font-normal">{employer_contributions?.waiting_period}</span></span>}
                {employer_contributions?.safe_harbor && <span className="font-semibold">Safe Harbor: <span className="font-normal">{employer_contributions?.safe_harbor}</span></span>}
                {employer_contributions?.non_elective && <span className="font-semibold">Non-Elective: <span className="font-normal">{employer_contributions?.non_elective}</span></span>}
                {employer_contributions?.waiting_period_sub && <span className="font-semibold">Waiting Period: <span className="font-normal">{employer_contributions?.waiting_period_sub}</span></span>}

            </div>
        </div>
        <div className="flex flex-col items-center justify-center">
            <div
                className={`flex items-center gap-[4px] px-[8px] py-[8px] text-white w-full`}
                style={{ backgroundColor: currentVideo?.clientColor }}
            >
                <LineChart className="w-[16px] h-[16px] text-white" />
                <span className="text-[12px] text-white font-semibold">
                    VESTING AND OPERATIONS
                </span>
            </div>
            <div className="w-full flex justify-between my-[4px] flex-col md:!flex-row items-start gap-[12px]">
                <div className="flex-col flex gap-[2px]">
                {vesting_and_operations?.vesting && <span className="font-semibold w-full my-[4px] items-start">Vesting: <span className="font-normal">{vesting_and_operations?.vesting}</span></span>}
                    {vesting_and_operations?.qdia && <span className="font-semibold">QDIA: <span className="font-normal">{vesting_and_operations?.qdia}</span></span>}
                    {vesting_and_operations?.loans_permitted && <span className="font-semibold">Loans Permitted: <span className="font-normal">{vesting_and_operations?.loans_permitted}</span></span>}
                    
                    {vesting_and_operations?.hardships_permitted && <span className="font-semibold">Hardships Permitted: <span className="font-normal">{vesting_and_operations?.hardships_permitted}</span></span>}
                </div>
                <div className="flex-col flex gap-[2px] md:items-end">
                    
                    {vesting_and_operations?.target_date && <span className="font-semibold">Target Date: <span className="font-normal">{vesting_and_operations?.target_date}</span></span>}
                    {vesting_and_operations?.models && <span className="font-semibold">Models: <span className="font-normal">{vesting_and_operations?.models}</span></span>}                        {vesting_and_operations?.sd_brokerage_account && <span className="font-semibold">SD Brokerage Account: <span className="font-normal">{vesting_and_operations?.sd_brokerage_account}</span></span>}
                    {vesting_and_operations?.managed_accounts && <span className="font-semibold">Managed Accounts: <span className="font-normal">{vesting_and_operations?.managed_accounts}</span></span>}
                
                </div>
            </div>
        </div>
        </div>
    )
}