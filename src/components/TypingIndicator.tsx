import { Sparkles } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      {/* AI Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>

      {/* Typing Bubble */}
      <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-sm max-w-[200px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
