import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function VoiceTextarea({
  value,
  onChange,
  rows = 5,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    setSupported(Boolean(SpeechRecognition));

    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      toast.error("Голосовий ввід підтримується в Chrome та деяких браузерах на його основі.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "uk-UA";
    recognition.interimResults = true;
    recognition.continuous = true;
    baseTextRef.current = value.trim();

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) continue;
        if (result.isFinal) finalText += `${transcript} `;
        else interimText += `${transcript} `;
      }

      const parts = [baseTextRef.current, finalText.trim(), interimText.trim()].filter(Boolean);
      onChange(parts.join(" ").trim());

      if (finalText.trim()) {
        baseTextRef.current = [baseTextRef.current, finalText.trim()].filter(Boolean).join(" ");
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      const error = event.error === "not-allowed"
        ? "Дозвольте доступ до мікрофона в браузері."
        : "Не вдалося розпізнати голос. Спробуйте ще раз.";
      toast.error(error);
    };

    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      toast.error("Голосовий ввід уже запущено або браузер тимчасово його заблокував.");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {supported ? "Говоріть українською, текст з'явиться нижче." : "Голосовий ввід доступний не у всіх браузерах."}
        </div>
        <Button
          type="button"
          variant={listening ? "default" : "outline"}
          size="sm"
          onClick={listening ? stopListening : startListening}
          disabled={disabled || !supported}
        >
          {listening ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
          {listening ? "Зупинити" : "Голосом"}
        </Button>
      </div>
      <Textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}
