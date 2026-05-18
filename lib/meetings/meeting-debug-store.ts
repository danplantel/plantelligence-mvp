import { create } from "zustand";
import { useMeetingStore } from "./meeting-store";


interface MeetingType {
  id?: string;
  value: string;
  label: string;
  description: string;
}

interface SaveMeetingDebugStore {
    savedMeetings: MeetingType[];
    deletedMeeting?: MeetingType;
    saveCustomMeeting: (meeting: MeetingType) => void;
    deleteMeeting: (meeting: MeetingType) => void;
    clearSaved: () => void;
    rebaseCustomMeeting: () => Promise<void>;
}
  
const MEETING_TYPES: MeetingType[] = [
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
  

export const useSaveMeetingDebugStore = create<SaveMeetingDebugStore>((set, get) => ({
    savedMeetings: [],
    deletedMeeting: undefined,
  
    saveCustomMeeting: (meeting) => {
      set((state) => {
        const existsInSaved = state.savedMeetings.some(
          (m) =>
            m.value === meeting.value &&
            m.label === meeting.label &&
            m.description === meeting.description
        );
  
        const existsInBase = MEETING_TYPES.some(
          (m) =>
            m.value === meeting.value &&
            m.label === meeting.label &&
            m.description === meeting.description
        );
  
        if (existsInSaved || existsInBase) return {};
  
        return {
          savedMeetings: [...state.savedMeetings, meeting],
        };
      });
    },
  
    deleteMeeting: (meeting) => {
      set((state) => ({
        savedMeetings: state.savedMeetings.filter((m) => m !== meeting),
        deletedMeeting: meeting,
      }));
    },
  
    clearSaved: () => set({ savedMeetings: [], deletedMeeting: undefined }),

    rebaseCustomMeeting: async () => {
        const user = await fetch("/api/auth/session");
        const userData = await user.json();
        const userId = userData.user.id;
      
        const currentSaved = get().savedMeetings;
      
        const meetingStore = useMeetingStore.getState();
        const prevMeetings = meetingStore.customMeetings;
      
        const optimisticallyUpdated = [...prevMeetings, ...currentSaved];
        useMeetingStore.setState({ customMeetings: optimisticallyUpdated });
      
        try {
          const resPut = await fetch(`/api/user/${userId}/custom-meetings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customMeetings: optimisticallyUpdated }),
          });
      
          const putData = await resPut.json();
      
          if (!putData.success) throw new Error("PUT failed");
      
          useMeetingStore.setState({ customMeetings: putData.data });
      
          set({ savedMeetings: [] });
        } catch (err) {
          console.error("Failed to rebase custom meetings:", err);
          useMeetingStore.setState({ customMeetings: prevMeetings });
        }
      },
}));
  