"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, Mail, Globe, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

type ContactInfoType = "phone" | "email";
type ActionButtonType = "schedule" | "website";

interface ContactInfoItem {
  id: ContactInfoType;
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface ActionButton {
  id: ActionButtonType;
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface ContactCardActionsProps {
  displayScheduleAppointment: boolean;
  displayPhone: boolean;
  displayEmail: boolean;
  displayWebsite: boolean;
  onScheduleAppointmentChange: (value: boolean) => void;
  onPhoneChange: (value: boolean) => void;
  onEmailChange: (value: boolean) => void;
  onWebsiteChange: (value: boolean) => void;
  contactInfoOrder?: ContactInfoType[];
  onContactInfoOrderChange?: (order: ContactInfoType[]) => void;
  actionButtonOrder?: ActionButtonType[];
  onActionButtonOrderChange?: (order: ActionButtonType[]) => void;
  disabled?: boolean;
  error?: string;
}

function SortableContactInfoItem({
  item,
  disabled,
}: {
  item: ContactInfoItem;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
        isDragging && "shadow-lg",
      )}
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors",
            disabled && "cursor-not-allowed opacity-50",
          )}
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="flex items-center gap-3 flex-1">
          {item.icon}
          <Label
            htmlFor={item.id}
            className="text-sm font-medium cursor-pointer dark:text-gray-300"
          >
            {item.label}
          </Label>
        </div>
      </div>
      <input
        type="checkbox"
        id={item.id}
        checked={item.checked}
        onChange={(e) => {
          if (!disabled) {
            item.onChange(e.target.checked);
          }
        }}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 text-accent-blue focus:ring-accent-blue cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

function SortableActionButton({
  button,
  disabled,
  isPrimary,
}: {
  button: ActionButton;
  disabled: boolean;
  isPrimary: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: button.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
        isDragging && "shadow-lg",
      )}
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors",
            disabled && "cursor-not-allowed opacity-50",
          )}
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="flex items-center gap-3 flex-1">
          {button.icon}
          <div>
            <Label
              htmlFor={button.id}
              className="text-sm font-medium cursor-pointer dark:text-gray-300"
            >
              {button.label}
            </Label>
            {isPrimary && (
              <Badge
                variant="secondary"
                className="ml-2 text-xs bg-accent-blue/10 text-accent-blue dark:bg-accent-blue/20 dark:text-accent-blue-light"
              >
                Primary
              </Badge>
            )}
          </div>
        </div>
      </div>
      <input
        type="checkbox"
        id={button.id}
        checked={button.checked}
        onChange={(e) => {
          if (!disabled) {
            button.onChange(e.target.checked);
          }
        }}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 text-accent-blue focus:ring-accent-blue cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export function ContactCardActions({
  displayScheduleAppointment,
  displayPhone,
  displayEmail,
  displayWebsite,
  onScheduleAppointmentChange,
  onPhoneChange,
  onEmailChange,
  onWebsiteChange,
  contactInfoOrder,
  onContactInfoOrderChange,
  actionButtonOrder,
  onActionButtonOrderChange,
  disabled = false,
  error,
}: ContactCardActionsProps) {
  // Default orders if not provided
  const defaultContactInfoOrder: ContactInfoType[] = ["phone", "email"];
  const defaultActionButtonOrder: ActionButtonType[] = ["schedule", "website"];

  // Use props directly — no local state or useEffect syncing, which eliminates
  // the infinite re-render loop when parent passes new array references every
  // render (e.g. `contact.contactInfoOrder || ["phone", "email"]`).
  const contactInfoOrderState = contactInfoOrder || defaultContactInfoOrder;
  const actionButtonOrderState = actionButtonOrder || defaultActionButtonOrder;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleContactInfoDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = contactInfoOrderState.indexOf(
        active.id as ContactInfoType,
      );
      const newIndex = contactInfoOrderState.indexOf(
        over.id as ContactInfoType,
      );
      const newOrder = arrayMove(contactInfoOrderState, oldIndex, newIndex);
      if (onContactInfoOrderChange) {
        onContactInfoOrderChange(newOrder);
      }
    }
  };

  const handleActionButtonDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = actionButtonOrderState.indexOf(
        active.id as ActionButtonType,
      );
      const newIndex = actionButtonOrderState.indexOf(
        over.id as ActionButtonType,
      );
      const newOrder = arrayMove(actionButtonOrderState, oldIndex, newIndex);
      if (onActionButtonOrderChange) {
        onActionButtonOrderChange(newOrder);
      }
    }
  };

  // Determine which button is primary (first checked button in order)
  // Only buttons (schedule, website) can be primary, not phone/email
  const getPrimaryButton = (): ActionButtonType | null => {
    for (const buttonType of actionButtonOrderState) {
      if (buttonType === "schedule" && displayScheduleAppointment)
        return "schedule";
      if (buttonType === "website" && displayWebsite) return "website";
    }
    return null;
  };

  const primaryButton = getPrimaryButton();

  const contactInfoItems: ContactInfoItem[] = contactInfoOrderState.map(
    (itemType) => {
      switch (itemType) {
        case "phone":
          return {
            id: "phone",
            label: "Display Phone Number",
            icon: <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />,
            checked: displayPhone,
            onChange: onPhoneChange,
          };
        case "email":
          return {
            id: "email",
            label: "Display Email",
            icon: <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />,
            checked: displayEmail,
            onChange: onEmailChange,
          };
      }
    },
  );

  const actionButtons: ActionButton[] = actionButtonOrderState.map(
    (buttonType) => {
      switch (buttonType) {
        case "schedule":
          return {
            id: "schedule",
            label: "Schedule Appointment",
            icon: <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />,
            checked: displayScheduleAppointment,
            onChange: onScheduleAppointmentChange,
          };
        case "website":
          return {
            id: "website",
            label: "Visit Website",
            icon: <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />,
            checked: displayWebsite,
            onChange: onWebsiteChange,
          };
      }
    },
  );

  return (
    <div className="space-y-4 border-t pt-4 dark:border-gray-700">
      <div className="space-y-2">
        <Label className="text-base font-semibold dark:text-gray-100">Contact Card Actions</Label>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose which buttons appear on the contact card
        </p>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      {/* Contact Info Section */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Contact Information
        </Label>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleContactInfoDragEnd}
        >
          <SortableContext
            items={contactInfoOrderState}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {contactInfoItems.map((item) => (
                <SortableContactInfoItem
                  key={item.id}
                  item={item}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Action Buttons Section */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Action Buttons
        </Label>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleActionButtonDragEnd}
        >
          <SortableContext
            items={actionButtonOrderState}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {actionButtons.map((button) => (
                <SortableActionButton
                  key={button.id}
                  button={button}
                  disabled={disabled}
                  isPrimary={primaryButton === button.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        First checked button will be the primary button, drag to change order
      </p>
    </div>
  );
}
