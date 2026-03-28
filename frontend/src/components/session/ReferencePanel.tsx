"use client";

import { useCoachStore } from "@/stores/coachStore";
import { useSessionStore } from "@/stores/sessionStore";
import CoachFeedback from "./CoachFeedback";
import ChatInput from "./ChatInput";
import VoiceToggle from "./VoiceToggle";

interface ReferencePanelProps {
  onChatSend: (message: string) => void;
  onBeforeVoiceEnable?: () => void;
}

export default function ReferencePanel({
  onChatSend,
  onBeforeVoiceEnable,
}: ReferencePanelProps) {
  const {
    messages,
    voiceEnabled,
    toggleVoice,
    liveCaption,
    liveConnectionState,
    liveError,
    liveServerEventsCount,
  } = useCoachStore();
  const { referenceImageUrl } = useSessionStore();

  return (
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/10 bg-[#0c0c14] p-4">
      {/* Reference Sketch */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="border-b border-white/10 px-3 py-2">
          <span className="text-[12px] font-medium uppercase tracking-wider text-white/40">
            Reference
          </span>
        </div>
        <div className="flex aspect-square items-center justify-center p-2">
          {referenceImageUrl ? (
            <img
              src={referenceImageUrl}
              alt="Reference sketch"
              className="h-full w-full rounded-lg object-contain"
            />
          ) : (
            <span className="text-[14px] text-white/30">[Reference Sketch]</span>
          )}
        </div>
      </div>

      {/* Coach Feedback */}
      <CoachFeedback
        messages={messages}
        liveCaption={liveCaption}
        liveConnectionState={liveConnectionState}
        liveError={liveError}
        liveServerEventsCount={liveServerEventsCount}
        voiceEnabled={voiceEnabled}
      />

      {/* Chat Input */}
      <ChatInput onSend={onChatSend} />

      {/* Voice Toggle */}
      <VoiceToggle
        isEnabled={voiceEnabled}
        onBeforeVoiceEnable={onBeforeVoiceEnable}
        onToggle={toggleVoice}
      />
    </aside>
  );
}
