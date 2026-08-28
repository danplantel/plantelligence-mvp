import { FAQItem } from "./benefits-wizard-store";

export const DEFAULT_FAQS: Record<string, FAQItem[]> = {
    "Retirement": [
        {
            id: "ret-1",
            question: "401(k) Plan Materials",
            answer: "New employee? Let us help you understand the financial benefits of participation in your employer-sponsored retirement plan.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        },
        {
            id: "ret-2",
            question: "Understanding Investment Options",
            answer: "Allow us to help educate you toward an appropriate investment strategy based on your time horizon and risk tolerance.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        },
        {
            id: "ret-3",
            question: "What should I do with my previous employer retirement plan(s)?",
            answer: "Have you left an employer, but your retirement assets remain? We're here to help you understand your options.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        },
        {
            id: "ret-4",
            question: "How much should I be saving towards a successful retirement?",
            answer: "Understanding the long-term impact of your current deferral rate is the best way to determine what your future retirement might be. Let's review together.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        },
        {
            id: "ret-5",
            question: "Comprehensive Financial Planning",
            answer: "Are you aware that comprehensive financial planning is included at no additional cost to you as a part of your benefits package? Through financial planning we're here to help you create a personal roadmap towards a confident retirement.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        },
        {
            id: "ret-6",
            question: "Review my other investments outside of the plan",
            answer: "Do you have an IRA, old 401(k), or other investment accounts? Before making investment changes within the 401(k) plan, it's important to understand how all your investment assets work together.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        },
        {
            id: "ret-7",
            question: "How will I pay for my child's post-secondary education?",
            answer: "A tax-advantaged 529 college savings plan can be used to pay for college or vocational school. With so many choices available \u2014 It's important to understand what option works best for you.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        },
        {
            id: "ret-8",
            question: "Can I take a loan from my 401(k)?",
            answer: "Many retirement plans allow participants to take loans against their vested balance. Loan terms, limits, and repayment schedules vary by plan. Contact us to review your plan's specific loan provisions.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        },
        {
            id: "ret-9",
            question: "What is a hardship withdrawal?",
            answer: "A hardship withdrawal allows you to access your retirement savings in the event of an immediate and heavy financial need, such as medical expenses or preventing eviction. Withdrawals may be subject to taxes and penalties.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        },
        {
            id: "ret-10",
            question: "How do I change my contribution rate?",
            answer: "You can typically increase or decrease your contribution percentage at any time through the retirement portal. Changes usually take effect within 1\u20132 pay cycles.",
            linkLabel: "",
            linkHref: "",
            enabled: true
        }
    ],
    "Group Health": [
        {
            id: "health-1",
            question: "What does my health insurance cover?",
            answer: "Review your full benefits and cost details in your plan\u2019s Summary of Benefits and Coverage (SBC).",
            linkLabel: "View Benefits Summary",
            linkHref: "",
            enabled: true
        },
        {
            id: "health-2",
            question: "How do I enroll or make changes?",
            answer: "You can enroll or update your coverage during open enrollment or after a qualifying life event using your benefits portal.",
            linkLabel: "Go to Benefits Portal",
            linkHref: "",
            enabled: true
        },
        {
            id: "health-3",
            question: "How do I find an in-network doctor or specialist?",
            answer: "Use your insurance carrier\u2019s provider directory to search for in-network doctors, hospitals, urgent care, and specialists near you.",
            linkLabel: "Search for Providers",
            linkHref: "",
            enabled: true
        },
        {
            id: "health-4",
            question: "Where can I view my digital ID card?",
            answer: "Most carriers provide instant access to your digital ID card in your online member account or mobile app.",
            linkLabel: "Download Digital ID Card",
            linkHref: "",
            enabled: true
        },
        {
            id: "health-5",
            question: "What\u2019s the difference between a deductible, copay, and coinsurance?",
            answer: "View your personalized cost-sharing details and plan documents online to understand how deductibles, copays, and coinsurance work together.",
            linkLabel: "Check My Plan Costs",
            linkHref: "",
            enabled: true
        },
        {
            id: "health-6",
            question: "Why did I receive a bill after visiting the doctor?",
            answer: "Compare the bill with your Explanation of Benefits (EOB) from your carrier. The EOB explains what the insurance covered and what you may owe.",
            linkLabel: "Review Claims & EOBs",
            linkHref: "",
            enabled: true
        },
        {
            id: "health-7",
            question: "Do preventive services cost anything?",
            answer: "Preventive care is usually covered at 100% when using in-network providers. Confirm what\u2019s covered under your specific plan.",
            linkLabel: "See Preventive Services List",
            linkHref: "",
            enabled: true
        },
        {
            id: "health-8",
            question: "How do I check if a prescription is covered?",
            answer: "Look up your prescription drug coverage and pricing through your carrier\u2019s online portal or member app.",
            linkLabel: "Check Prescription Coverage",
            linkHref: "",
            enabled: true
        },
        {
            id: "health-9",
            question: "How do I add or remove dependents?",
            answer: "You can update dependents through your benefits portal during open enrollment or within 30 days of a qualifying life event.",
            linkLabel: "Manage Dependents",
            linkHref: "",
            enabled: true
        }
    ],
    "Group Life": [
        {
            id: "life-1",
            question: "How much life insurance coverage do I have?",
            answer: "You can view your current coverage amount in your benefits profile and plan documents.",
            linkLabel: "View Life Insurance Coverage",
            linkHref: "",
            enabled: true
        },
        {
            id: "life-2",
            question: "Can I purchase additional voluntary life insurance?",
            answer: "Check voluntary coverage options and costs available to you through your benefits portal.",
            linkLabel: "Explore Voluntary Life Insurance",
            linkHref: "",
            enabled: true
        },
        {
            id: "life-3",
            question: "Do I need Evidence of Insurability (EOI)?",
            answer: "If your coverage level requires medical review, you can complete the Evidence of Insurability form online through the benefits portal.",
            linkLabel: "Complete EOI Form",
            linkHref: "",
            enabled: true
        },
        {
            id: "life-4",
            question: "How do I update my beneficiary?",
            answer: "You can update your beneficiaries anytime in your benefits portal.",
            linkLabel: "Update Beneficiary Information",
            linkHref: "",
            enabled: true
        },
        {
            id: "life-5",
            question: "What does life insurance pay for?",
            answer: "Learn how your life insurance benefit can support your loved ones and provide financial security.",
            linkLabel: "Life Insurance Overview",
            linkHref: "",
            enabled: true
        },
        {
            id: "life-6",
            question: "Can I add coverage for my spouse or dependents?",
            answer: "Many plans allow voluntary spouse and child coverage. Check available options in your benefits portal.",
            linkLabel: "View Family Life Insurance Options",
            linkHref: "",
            enabled: true
        }
    ]
};
