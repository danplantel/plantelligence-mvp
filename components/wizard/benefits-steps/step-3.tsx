"use client";

import { useState, useEffect } from "react";
import {
  useBenefitsWizardStore,
  FAQItem,
  SupportContact,
} from "@/lib/benefits-wizard-store";
import { DEFAULT_FAQS } from "@/lib/benefits-faq-defaults";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Headshot } from "@/components/ui/headshot";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  HelpCircle,
  Users,
  Check,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { KeyContact } from "@/types/new-client-wizard";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function BenefitsStep3() {
  const { stepData, saveStepData } = useBenefitsWizardStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const step1Data = stepData.step1;
  const currentStep3Data = stepData.step3 || {
    faqs: [],
    supportContacts: [],
    currentSubStep: "a",
  };

  const selectedPlan = step1Data?.selectedPlan;
  const [localContacts, setLocalContacts] = useState<KeyContact[]>([]);

  useEffect(() => {
    if (selectedPlan?.keyContacts) {
      const contacts = Array.isArray(selectedPlan.keyContacts)
        ? selectedPlan.keyContacts
        : selectedPlan.keyContacts.contacts || [];
      setLocalContacts(contacts);
    } else if (step1Data?.planId) {
      // Fallback: Fetch plan data if it's missing from store
      fetch(`/api/clients/${step1Data.planId}`)
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            const contacts = Array.isArray(result.data.keyContacts)
              ? result.data.keyContacts
              : result.data.keyContacts?.contacts || [];
            setLocalContacts(contacts);

            // Also update the store for consistency
            saveStepData(1, {
              ...step1Data,
              selectedPlan: result.data
            });
          }
        })
        .catch(err => console.error("Error fetching contacts in Step 3:", err));
    }
  }, [selectedPlan, step1Data?.planId]);

  const planContacts = localContacts;

  if (process.env.NODE_ENV === 'development') {
    // console.log("[Step 3] planContacts:", planContacts, "planId:", step1Data?.planId);
  }

  // Initialize with defaults if empty
  useEffect(() => {
    if (currentStep3Data.faqs.length === 0 && step1Data?.benefitCategory) {
      const defaults = DEFAULT_FAQS[step1Data.benefitCategory] || [];
      saveStepData(3, {
        ...currentStep3Data,
        faqs: defaults,
      });
      if (defaults.length > 0) setExpandedId(defaults[0].id);
    }
  }, [step1Data?.benefitCategory]);

  // Handle FAQ changes
  const updateFaq = (id: string, updates: Partial<FAQItem>) => {
    const newFaqs = currentStep3Data.faqs.map((faq) =>
      faq.id === id ? { ...faq, ...updates } : faq,
    );
    saveStepData(3, { ...currentStep3Data, faqs: newFaqs });
  };

  const addFaq = () => {
    const id = uuidv4();
    const newFaq: FAQItem = {
      id,
      question: "New Question?",
      answer: "Provide an answer here.",
      linkLabel: "Learn More",
      linkHref: "#",
      enabled: true,
    };
    // Add to TOP
    saveStepData(3, {
      ...currentStep3Data,
      faqs: [newFaq, ...currentStep3Data.faqs],
    });
    setExpandedId(id);
  };

  const removeFaq = (id: string) => {
    const newFaqs = currentStep3Data.faqs.filter((faq) => faq.id !== id);
    saveStepData(3, { ...currentStep3Data, faqs: newFaqs });
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = currentStep3Data.faqs.findIndex(
        (f) => f.id === active.id,
      );
      const newIndex = currentStep3Data.faqs.findIndex((f) => f.id === over.id);
      const newFaqs = arrayMove(currentStep3Data.faqs, oldIndex, newIndex);
      saveStepData(3, { ...currentStep3Data, faqs: newFaqs });
    }
  };

  // Handle Contact changes
  const toggleContact = (contactId: string) => {
    const existing = currentStep3Data.supportContacts.find(
      (sc) => sc.contactId === contactId,
    );
    if (existing) {
      const newContacts = currentStep3Data.supportContacts.filter(
        (sc) => sc.contactId !== contactId,
      );
      saveStepData(3, { ...currentStep3Data, supportContacts: newContacts });
    } else {
      const contact = planContacts.find((c) => c.id === contactId);
      const newContact: SupportContact = {
        contactId,
        title: contact?.title || "Support Contact",
        description: "Contact for any questions regarding this benefit.",
        enabled: true,
      };
      saveStepData(3, {
        ...currentStep3Data,
        supportContacts: [...currentStep3Data.supportContacts, newContact],
      });
    }
  };

  const updateSupportContact = (
    contactId: string,
    updates: Partial<SupportContact>,
  ) => {
    const newContacts = currentStep3Data.supportContacts.map((sc) =>
      sc.contactId === contactId ? { ...sc, ...updates } : sc,
    );
    saveStepData(3, { ...currentStep3Data, supportContacts: newContacts });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full mx-auto pb-20">
      {/* FAQ Section */}
      <Card className="border-none shadow-md overflow-hidden bg-card">
        <CardHeader className="py-2 border-b bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-accent-blue" />
              <div>
                <CardTitle className="text-lg font-bold text-foreground">
                  Popular Questions (FAQ)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Manage frequently asked questions for this benefit.
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={addFaq}
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-3 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {currentStep3Data.faqs.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200 dark:bg-gray-800/50 dark:border-gray-700">
              <HelpCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">
                No questions added yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentStep3Data.faqs.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {currentStep3Data.faqs.map((faq, index) => (
                    <SortableFaqItem
                      key={faq.id}
                      faq={faq}
                      index={index}
                      expandedId={expandedId}
                      toggleExpand={toggleExpand}
                      updateFaq={updateFaq}
                      removeFaq={removeFaq}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Support Contacts Section */}
      <Card className="border-none shadow-md overflow-hidden bg-card">
        <CardHeader className="py-2 border-b bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-blue" />
            Support Contacts
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Select one or more contacts for users to reach out to.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 gap-2">
            {planContacts.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200 dark:bg-gray-800/50 dark:border-gray-700">
                <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No support contacts available.</p>
                <p className="text-xs text-muted-foreground mt-1">Please add contacts in Step 1 or check your connection.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 h-8 text-xs"
                  onClick={() => useBenefitsWizardStore.getState().goToStep(1)}
                >
                  Go to Step 1 Selection
                </Button>
              </div>
            ) : planContacts.map((contact) => {
              const isSelected = currentStep3Data.supportContacts.some(
                (sc) => sc.contactId === contact.id,
              );
              const supportConfig = currentStep3Data.supportContacts.find(
                (sc) => sc.contactId === contact.id,
              );

              return (
                <div key={contact.id} className="space-y-1.5">
                  <div
                    className={`flex items-center p-2 rounded-lg border cursor-pointer transition-all ${isSelected
                      ? "border-accent-blue bg-accent-blue/[0.02]"
                      : "border-gray-100 bg-white hover:border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                      }`}
                    onClick={() => toggleContact(contact.id)}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center mr-2.5 transition-colors ${isSelected
                        ? "bg-accent-blue border-accent-blue text-white"
                        : "bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600"
                        }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    {contact.headshot && (
                      <div className="w-8 h-8 rounded-full overflow-hidden mr-2.5 border border-gray-100 dark:border-gray-700 shrink-0">
                        <Headshot src={contact.headshot} alt={contact.name ?? "Contact"} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-foreground leading-tight truncate">
                        {contact.name ||
                          `${contact.firstName} ${contact.lastName}`}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">
                        {contact.title || "No Title"}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1 ml-2">
                      <p className="text-xs text-muted-foreground font-medium leading-none truncate max-w-[150px]">
                        {contact.email}
                      </p>
                      <p className="text-xs text-muted-foreground leading-none">
                        {contact.phone}
                      </p>
                    </div>
                  </div>

                  {isSelected && supportConfig && (
                    <div className="ml-7 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2.5 animate-in slide-in-from-top-1 duration-200 dark:bg-gray-800/50 dark:border-gray-700">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Display Title
                        </Label>
                        <Input
                          value={supportConfig.title}
                          onChange={(e) =>
                            updateSupportContact(contact.id, {
                              title: e.target.value,
                            })
                          }
                          placeholder="e.g. Retirement Plan Advisor"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Display Description
                        </Label>
                        <Textarea
                          value={supportConfig.description}
                          onChange={(e) =>
                            updateSupportContact(contact.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Short description..."
                          className="min-h-[50px] text-xs py-1.5"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SortableFaqItemProps {
  faq: FAQItem;
  index: number;
  expandedId: string | null;
  toggleExpand: (id: string) => void;
  updateFaq: (id: string, updates: Partial<FAQItem>) => void;
  removeFaq: (id: string) => void;
}

function SortableFaqItem({
  faq,
  index,
  expandedId,
  toggleExpand,
  updateFaq,
  removeFaq,
}: SortableFaqItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: faq.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    position: isDragging ? ("relative" as const) : ("static" as const),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "shadow-2xl ring-2 ring-accent-blue/20" : ""}`}
    >
      <div className="border rounded-lg bg-white overflow-hidden transition-all duration-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <div
          className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors ${expandedId === faq.id
            ? "bg-gray-50/50 border-b border-gray-100 dark:bg-gray-700/40 dark:border-gray-700"
            : ""
            }`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={() => toggleExpand(faq.id)}
        >
          <div className="flex items-center gap-2.5 flex-1 overflow-hidden">
            <div
              {...attributes}
              {...listeners}
              className="p-1 -ml-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-blue/10 text-accent-blue font-bold text-[10px] shrink-0">
              {index + 1}
            </div>
            <span
              className={`text-sm truncate transition-colors ${expandedId === faq.id
                ? "text-accent-blue font-semibold"
                : "text-foreground"
                }`}
            >
              {faq.question || `Question ${index + 1}`}
            </span>
          </div>
          <div
            className="flex items-center gap-2.5 ml-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={faq.enabled}
              onCheckedChange={(checked) =>
                updateFaq(faq.id, { enabled: checked })
              }
              className="scale-[0.65]"
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 h-6 w-6"
              onClick={() => removeFaq(faq.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <ChevronDown
              className={`w-4 h-4 text-neutral-400 dark:text-neutral-500 transition-transform duration-300 ${expandedId === faq.id ? "rotate-180" : ""
                }`}
            />
          </div>
        </div>

        <AnimatePresence>
          {expandedId === faq.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className="px-3 py-4 space-y-4 bg-white dark:bg-gray-800">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Question Text
                  </Label>
                  <Input
                    value={faq.question}
                    onChange={(e) =>
                      updateFaq(faq.id, { question: e.target.value })
                    }
                    placeholder="Enter question..."
                    className="h-8 text-xs font-medium text-foreground border-gray-200 focus:border-accent-blue dark:border-gray-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Answer
                  </Label>
                  <Textarea
                    value={faq.answer}
                    onChange={(e) =>
                      updateFaq(faq.id, { answer: e.target.value })
                    }
                    placeholder="Enter answer..."
                    className="min-h-[80px] text-xs leading-relaxed border-gray-200 focus:border-accent-blue dark:border-gray-600"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Link Label
                    </Label>
                    <Input
                      value={faq.linkLabel}
                      onChange={(e) =>
                        updateFaq(faq.id, { linkLabel: e.target.value })
                      }
                      placeholder="Learn More"
                      className="h-8 text-[11px] border-gray-200 focus:border-accent-blue dark:border-gray-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Link URL
                    </Label>
                    <Input
                      value={faq.linkHref}
                      onChange={(e) =>
                        updateFaq(faq.id, { linkHref: e.target.value })
                      }
                      placeholder="https://..."
                      className="h-8 text-[11px] border-gray-200 focus:border-accent-blue dark:border-gray-600"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
