import { FAQItem } from "./benefits-wizard-store";

export const DEFAULT_FAQS: Record<string, FAQItem[]> = {
    "Retirement": [
        {
            id: "ret-1",
            question: "401(k) Plan Materials",
            answer: "New employee? Let us help you understand the financial benefits of participation in your employer-sponsored retirement plan.",
            linkLabel: "Learn More",
            linkHref: "#",
            enabled: true
        },
        {
            id: "ret-2",
            question: "Understanding Investment Options",
            answer: "Allow us to help educate you toward an appropriate investment strategy based on your time horizon and risk tolerance.",
            linkLabel: "Learn More",
            linkHref: "#",
            enabled: true
        },
        {
            id: "ret-3",
            question: "What should I do with my previous employer retirement plan(s)?",
            answer: "Have you left an employer, but your retirement assets remain? We're here to help you understand your options.",
            linkLabel: "Learn More",
            linkHref: "#",
            enabled: true
        },
        {
            id: "ret-4",
            question: "How much should I be saving towards a successful retirement?",
            answer: "Understanding the long-term impact of your current deferral rate is the best way to determine what your future retirement might be. Let's review together.",
            linkLabel: "Learn More",
            linkHref: "#",
            enabled: true
        },
        {
            id: "ret-5",
            question: "Comprehensive Financial Planning",
            answer: "Are you aware that comprehensive financial planning is included at no additional cost to you as a part of your benefits package? Through financial planning we're here to help you create a personal roadmap towards a confident retirement.",
            linkLabel: "Learn More",
            linkHref: "#",
            enabled: true
        },
        {
            id: "ret-6",
            question: "Review my other investments outside of the plan",
            answer: "Do you have an IRA, old 401(k), or other investment accounts? Before making investment changes within the 401(k) plan, it's important to understand how all your investment assets work together.",
            linkLabel: "Learn More",
            linkHref: "#",
            enabled: true
        },
        {
            id: "ret-7",
            question: "How will I pay for my child's post-secondary education?",
            answer: "A tax-advantaged 529 college savings plan can be used to pay for college or vocational school. With so many choices available \u2014 It's important to understand what option works best for you.",
            linkLabel: "Learn More",
            linkHref: "#",
            enabled: true
        }
    ],
    "Group Health": [
        {
            id: "health-1",
            question: "What does my health insurance cover?",
            answer: "Review your full benefits and cost details in your plan\u2019s Summary of Benefits and Coverage (SBC).",
            linkLabel: "View Benefits Summary",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-2",
            question: "How do I enroll or make changes?",
            answer: "You can enroll or update your coverage during open enrollment or after a qualifying life event using your benefits portal.",
            linkLabel: "Go to Benefits Portal",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-3",
            question: "How do I find an in-network doctor or specialist?",
            answer: "Use your insurance carrier\u2019s provider directory to search for in-network doctors, hospitals, urgent care, and specialists near you.",
            linkLabel: "Search for Providers",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-4",
            question: "Where can I view my digital ID card?",
            answer: "Most carriers provide instant access to your digital ID card in your online member account or mobile app.",
            linkLabel: "Download Digital ID Card",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-5",
            question: "What\u2019s the difference between a deductible, copay, and coinsurance?",
            answer: "View your personalized cost-sharing details and plan documents online to understand how deductibles, copays, and coinsurance work together.",
            linkLabel: "Check My Plan Costs",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-6",
            question: "Why did I receive a bill after visiting the doctor?",
            answer: "Compare the bill with your Explanation of Benefits (EOB) from your carrier. The EOB explains what the insurance covered and what you may owe.",
            linkLabel: "Review Claims & EOBs",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-7",
            question: "Do preventive services cost anything?",
            answer: "Preventive care is usually covered at 100% when using in-network providers. Confirm what\u2019s covered under your specific plan.",
            linkLabel: "See Preventive Services List",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-8",
            question: "How do I check if a prescription is covered?",
            answer: "Look up your prescription drug coverage and pricing through your carrier\u2019s online portal or member app.",
            linkLabel: "Check Prescription Coverage",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-9",
            question: "How do I add or remove dependents?",
            answer: "You can update dependents through your benefits portal during open enrollment or within 30 days of a qualifying life event.",
            linkLabel: "Manage Dependents",
            linkHref: "#",
            enabled: true
        }
    ],
    "Group Life": [
        {
            id: "life-1",
            question: "Is basic life insurance provided by the company?",
            answer: "Yes, the company provides basic life insurance and AD&D coverage at no cost to all full-time employees, typically equal to 1x your annual salary.",
            linkLabel: "Benefit Details",
            linkHref: "#",
            enabled: true
        },
        {
            id: "life-2",
            question: "Can I purchase additional life insurance?",
            answer: "Yes, you have the option to purchase supplemental life insurance for yourself, your spouse, and your children during open enrollment or within 30 days of a qualifying life event.",
            linkLabel: "Supplemental Options",
            linkHref: "#",
            enabled: true
        },
        {
            id: "life-3",
            question: "How do I update my beneficiaries?",
            answer: "You can update your beneficiary designations at any time through the HR portal. It is recommended to review these annually or after major life events.",
            linkLabel: "Update Beneficiaries",
            linkHref: "#",
            enabled: true
        }
    ]
};
