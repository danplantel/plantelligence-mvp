import { FAQItem } from "./benefits-wizard-store";

export const DEFAULT_FAQS: Record<string, FAQItem[]> = {
    "Retirement": [
        {
            id: "ret-1",
            question: "When am I eligible to enroll in the 401(k) plan?",
            answer: "Most employees are eligible to enroll on the first of the month following 30 days of employment. You will receive an enrollment package via email when you are eligible.",
            linkLabel: "View Enrollment Guide",
            linkHref: "#",
            enabled: true
        },
        {
            id: "ret-2",
            question: "How does the company match work?",
            answer: "The company matches 100% of your contributions up to 4% of your eligible compensation. This match is deposited into your account each pay period.",
            linkLabel: "Matching Details",
            linkHref: "#",
            enabled: true
        },
        {
            id: "ret-3",
            question: "Can I change my contribution amount mid-year?",
            answer: "Yes, you can increase or decrease your contribution percentage at any time through the retirement portal. Changes typically take 1-2 pay cycles to reflect.",
            linkLabel: "Access Portal",
            linkHref: "#",
            enabled: true
        }
    ],
    "Group Health": [
        {
            id: "health-1",
            question: "What is inclusive in my health coverage?",
            answer: "Our group health plan includes preventative care, specialist visits, emergency services, and prescription drug coverage. Specific copays and deductibles apply based on your selected tier.",
            linkLabel: "Plan Summary",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-2",
            question: "How do I find an in-network provider?",
            answer: "You can find a list of in-network doctors and facilities by visiting the insurance provider's website and using their 'Find a Doctor' tool with your plan ID.",
            linkLabel: "Provider Search",
            linkHref: "#",
            enabled: true
        },
        {
            id: "health-3",
            question: "What should I do if I lose my insurance card?",
            answer: "You can download a digital version of your insurance card through the provider's mobile app or request a replacement card through their member portal.",
            linkLabel: "Request New Card",
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
