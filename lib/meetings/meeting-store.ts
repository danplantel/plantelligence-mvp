import { create } from "zustand";

export type MeetingType = {
  id?: string;
  value: string;
  label: string;
  description: string;
};

export interface MeetingStore {
  customMeetings: MeetingType[];
  deletedMeeting?: MeetingType;
  addCustomMeeting: (meeting: MeetingType) => Promise<void>;
  deleteCustomMeeting: (meetingId: string) => Promise<void>;
  fetchCustomMeetings: () => Promise<void>;
  resetToDefaultMeetings: () => Promise<void>;
}

export const MEETING_TYPES: MeetingType[] = [
  {
    value: "Open Enrollment",
    label: "Open Enrollment",
    description:
      "Learn about upcoming plan options, updates, and key dates so you can make informed choices for the year ahead.",
  },
  {
    value: "Understanding Your Benefits",
    label: "Understanding Your Benefits",
    description:
      "Get a clear overview of your available benefits and how they can support your goals both now and in the future.",
  },
  {
    value: "One-on-One Consultations",
    label: "One-on-One Consultations",
    description:
      "Meet individually to ask questions and receive personalized guidance on your benefits and available resources.",
  },
];

export const useMeetingStore = create<MeetingStore>((set, get) => ({
  customMeetings: [],
  deletedMeeting: undefined,

  fetchCustomMeetings: async () => {
    try {
      const userRes = await fetch("/api/auth/session");
      const userData = await userRes.json();
      const userId = userData.user.id;

      const res = await fetch(`/api/user/${userId}/custom-meetings`);
      const data = await res.json();

      if (data.success && data.data.length > 0) {
        set({ customMeetings: data.data });
      } else {
        const defaultMeetings = [
          ...MEETING_TYPES,
          {
            value: "Custom",
            label: "Custom",
            description:
              "Enter your meeting description here. Use this option for any specialized session or unique topic not listed above.",
          },
        ];
        set({ customMeetings: defaultMeetings });

        await fetch(`/api/user/${userId}/custom-meetings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customMeetings: defaultMeetings }),
        });
      }
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
      const stored = localStorage.getItem("customMeetings");
      if (stored) set({ customMeetings: JSON.parse(stored) });
    }
  },

  addCustomMeeting: async (meeting) => {
    const prevMeetings = get().customMeetings;
    set({ customMeetings: [...prevMeetings, meeting] });

    try {
      const userRes = await fetch("/api/auth/session");
      const userData = await userRes.json();
      const userId = userData.user.id;

      const resGet = await fetch(`/api/user/${userId}/custom-meetings`);
      const getData = await resGet.json();
      if (!getData.success) throw new Error("Fetch failed");

      const updatedMeetings = [...getData.data, meeting];
      const resPut = await fetch(`/api/user/${userId}/custom-meetings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customMeetings: updatedMeetings }),
      });

      const putData = await resPut.json();
      if (!putData.success) throw new Error("Update failed");

      set({ customMeetings: putData.data });
      localStorage.setItem("customMeetings", JSON.stringify(putData.data));
    } catch (err) {
      console.error(err);
      set({ customMeetings: prevMeetings });
    }
  },

  deleteCustomMeeting: async (meetingId) => {
    const prevMeetings = get().customMeetings;
    const meetingToDelete = prevMeetings.find((m) => m.id === meetingId);
    if (!meetingToDelete) return;

    set({ 
      customMeetings: prevMeetings.filter((m) => m.id !== meetingId),
      deletedMeeting: meetingToDelete,
    });

    try {
      const userRes = await fetch("/api/auth/session");
      const userData = await userRes.json();
      const userId = userData.user.id;

      const res = await fetch(`/api/user/${userId}/custom-meetings`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Delete failed");
    } catch (err) {
      console.error(err);
      set({ customMeetings: prevMeetings, deletedMeeting: undefined });
    }
  },

  resetToDefaultMeetings: async () => {
    const prevMeetings = get().customMeetings;
    const defaultMeetings = [
      ...MEETING_TYPES,
      {
        value: "Custom",
        label: "Custom",
        description:
          "Enter your meeting description here. Use this option for any specialized session or unique topic not listed above.",
      },
    ];

    set({ customMeetings: defaultMeetings });

    try {
      const userRes = await fetch("/api/auth/session");
      const userData = await userRes.json();
      const userId = userData.user.id;

      const resPut = await fetch(`/api/user/${userId}/custom-meetings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customMeetings: defaultMeetings }),
      });

      const putData = await resPut.json();
      if (!putData.success) throw new Error("Reset failed");
      set({ customMeetings: putData.data });
    } catch (err) {
      console.error(err);
      set({ customMeetings: prevMeetings });
    }
  },
}));
