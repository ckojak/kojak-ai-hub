import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseVoiceReturn {
  estáEscutando: booleano;
  estáFalando: booleano;
  transcrição: string;
  iniciarEscuta: () => vazio;
  pararEscutando: () => vazio;
  falar: (texto: string) => vazio;
  pararDeFalar: () => vazio;
}

export function useVoice(): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcrição, definirTranscrição] = useState("");
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | nulo>(nulo);

  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.error("Reconhecimento de fala não suportado");
      retornar;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    reconhecimento.contínuo = falso;
    reconhecimento.resultadosinterinos = verdadeiro;
    recognition.lang = "pt-BR";

    reconhecimento.onstart = () => {
      setIsListening(true);
      setTranscrição("");
    };

    reconhecimento.onresultado = (evento) => {
      seja finalTranscript = "";
      para (let i = event.resultIndex; i < event.results.length; i++) {
        const transcrição = evento.resultados[i][0].transcrição;
        se (event.results[i].isFinal) {
          finalTransscript += transcrição;
        }
      }
      se (transcriçãofinal) {
        setTranscript(finalTranscript);
      }
    };

    reconhecimento.onerror = (evento) => {
      console.error("Erro de reconhecimento de fala:", event.error);
      setIsListening(false);
    };

    reconhecimento.onend = () => {
      setIsListening(false);
    };

    recognitionRef.atual = reconhecimento;
    reconhecimento.iniciar();
  }, []);

  const stopListening = useCallback(() => {
    se (recognitionRef.atual) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // Fallback: voz robótica nativa do navegador (usada só se a IA de voz falhar)
  const speakBrowserFallback = useCallback((cleanText: string) => {
    se (!("síntese de fala" na janela)) {
      console.error("Síntese de fala não suportada");
      retornar;
    }
    janela.sínteseDeFala.cancelar();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "pt-BR";
    taxa de enunciados = 0,92;
    utterance.pitch = 0.95;
    enunciado.volume = 0,9;

    const vozes = window.speechSynthesis.getVoices();
    const vozFeminina = vozes.find(
      (voz) =>
        voice.lang.includes("pt") &&
        (voice.name.toLowerCase().includes("female") ||
          voice.name.toLowerCase().includes("feminina") ||
          voice.name.includes("Luciana") ||
          voice.name.includes("Francisca") ||
          voice.name.includes("Google português"))
    );
    se (vozfeminina) enunciado.voz = vozfeminina;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    expressão.onerror = () => setIsSpeaking(false);

    janela.sínteseDeFala.fala(enunciado);
  }, []);

  const speak = useCallback((text: string) => {
    // Limpa markdown e código antes de mandar pra voz
    const textoLimpo = texto
      .replace(/```[\s\S]*?```/g, " código omitido ")
      .replace(/`[^`]+`/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_~]/g, "")
      .replace(/\n+/g, " ")
      .aparar();

    se (!cleanText) retornar;

    // Para qualquer áudio anterior
    se (audioRef.atual) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    janela.sínteseDeFala?.cancelar();

    setIsSpeaking(true);

    funções da base
      .invoke("kojak-voice", { body: { text: cleanText, voice: "Kore" } })
      .then(({ dados, erro }) => {
        se (erro || !dados?.áudio) {
          console.error("Voz neural indisponível, usando fallback do navegador:", erro);
          speakBrowserFallback(cleanText);
          retornar;
        }

        const audio = new Audio(data.audio);
        audioRef.atual = áudio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          console.error("Erro ao tocar áudio neural, usando fallback");
          speakBrowserFallback(cleanText);
        };
        audio.play().catch(() => speakBrowserFallback(cleanText));
      })
      .catch((err) => {
        console.error("Falha ao chamar kojak-voice:", err);
        speakBrowserFallback(cleanText);
      });
  }, [speakBrowserFallback]);

  const stopSpeaking = useCallback(() => {
    se (audioRef.atual) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    janela.sínteseDeFala?.cancelar();
    setIsSpeaking(false);
  }, []);

  retornar {
    está ouvindo,
    está falando,
    transcrição,
    iniciarOuvindo,
    pare de ouvir,
    falar,
    Pare de falar,
  };
}

// Adicionar declarações de tipo para a API Web Speech
declare global {
  interface Janela {
    Reconhecimento de fala: qualquer;
    webkitSpeechRecognition: qualquer;
  }
}