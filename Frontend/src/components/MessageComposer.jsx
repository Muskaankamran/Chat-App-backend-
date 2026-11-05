import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Smile,
  Square,
  X,
} from "lucide-react";

const emojis = ["🙂", "😂", "❤️", "🙌", "✨", "👍", "🥹", "🎉", "👀", "☕"];

function chooseRecordingType() {
  if (!window.MediaRecorder) return "";
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ].find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
}

export default function MessageComposer({ onSend, onUpload, onTyping, disabled }) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const recorder = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const discardRecording = useRef(false);
  const typingTimer = useRef(null);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(() => {
      setRecordingTime((time) => time + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!recordedAudio?.url) return undefined;
    return () => URL.revokeObjectURL(recordedAudio.url);
  }, [recordedAudio?.url]);

  useEffect(() => () => {
    window.clearTimeout(typingTimer.current);
    discardRecording.current = true;
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const formatRecordingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const remainder = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainder}`;
  };

  const startRecording = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice recording isn't available in this browser.");
      return;
    }

    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = chooseRecordingType();
      const activeRecorder = new MediaRecorder(
        stream.current,
        mimeType ? { mimeType } : undefined,
      );
      chunks.current = [];
      discardRecording.current = false;
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      activeRecorder.onstop = () => {
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (discardRecording.current || chunks.current.length === 0) return;
        const blob = new Blob(chunks.current, {
          type: activeRecorder.mimeType || "audio/webm",
        });
        setRecordedAudio({ blob, url: URL.createObjectURL(blob) });
      };
      recorder.current = activeRecorder;
      activeRecorder.start();
      setRecordingTime(0);
      setRecording(true);
    } catch (recordingError) {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setError(
        recordingError.name === "NotAllowedError"
          ? "Allow microphone access to record a voice message."
          : "Couldn't start voice recording.",
      );
    }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
  };

  const cancelRecording = () => {
    discardRecording.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setRecording(false);
    setRecordingTime(0);
    setRecordedAudio(null);
  };

  const sendText = async () => {
    const message = text.trim();
    if (!message || busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      await onSend(message);
      setText("");
      onTyping(false);
    } catch (sendError) {
      setError(sendError.message || "Message couldn't be sent.");
    } finally {
      setBusy(false);
    }
  };

  const sendVoice = async () => {
    if (!recordedAudio || busy) return;
    setBusy(true);
    setError("");
    const extension = recordedAudio.blob.type.includes("mp4") ? "m4a" : "webm";
    const voiceFile = new File(
      [recordedAudio.blob],
      `voice-message.${extension}`,
      { type: recordedAudio.blob.type },
    );
    try {
      await onUpload(voiceFile);
      setRecordedAudio(null);
      setRecordingTime(0);
    } catch (uploadError) {
      setError(uploadError.message || "Voice message couldn't be uploaded.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await onUpload(file);
    } catch (uploadError) {
      setError(uploadError.message || "The file couldn't be uploaded.");
    } finally {
      setBusy(false);
    }
  };

  const handleTextChange = (event) => {
    setText(event.target.value);
    setError("");
    onTyping(Boolean(event.target.value.trim()));
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => onTyping(false), 1200);
  };

  return (
    <div className="composer-wrap">
      {error && <div className="composer-error" role="alert">{error}</div>}
      {recording && (
        <div className="recording-strip">
          <span className="recording-pulse" />
          <span>Recording voice message</span>
          <time>{formatRecordingTime(recordingTime)}</time>
          <button className="icon-button subtle-button" onClick={cancelRecording} title="Cancel recording">
            <X size={17} />
          </button>
          <button className="record-stop-button" onClick={stopRecording} title="Stop recording">
            <Square size={13} fill="currentColor" />
            Stop
          </button>
        </div>
      )}

      {recordedAudio && !recording && (
        <div className="audio-preview-strip">
          <button className="icon-button subtle-button" onClick={cancelRecording} title="Discard voice message">
            <X size={17} />
          </button>
          <audio controls src={recordedAudio.url} />
          <span className="recording-duration">{formatRecordingTime(recordingTime)}</span>
          <button className="send-preview-button" disabled={busy} onClick={sendVoice}>
            <Check size={16} /> {busy ? "Sending" : "Send voice"}
          </button>
        </div>
      )}

      {!recording && !recordedAudio && (
        <div className="composer">
          <div className="composer-tools">
            <button
              aria-label="Attach image"
              className="icon-button composer-tool"
              disabled={busy || disabled}
              onClick={() => fileInput.current?.click()}
              title="Share an image"
            >
              <Paperclip size={18} />
            </button>
            <input
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="visually-hidden"
              onChange={handleFile}
              ref={fileInput}
              type="file"
            />
            <button
              aria-label="Insert emoji"
              className={`icon-button composer-tool${emojiOpen ? " tool-active" : ""}`}
              onClick={() => setEmojiOpen((open) => !open)}
              title="Emoji"
              type="button"
            >
              <Smile size={18} />
            </button>
            {emojiOpen && (
              <div className="emoji-popover">
                {emojis.map((emoji) => (
                  <button
                    aria-label={`Insert ${emoji}`}
                    key={emoji}
                    onClick={() => {
                      setText((current) => `${current}${emoji}`);
                      setEmojiOpen(false);
                    }}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            aria-label="Write a message"
            disabled={disabled || busy}
            onChange={handleTextChange}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendText();
              }
            }}
            placeholder="Write a message..."
            rows={1}
            value={text}
          />
          <div className="composer-actions">
            {!text.trim() ? (
              <button
                aria-label="Record voice message"
                className="icon-button composer-tool voice-button"
                disabled={disabled || busy}
                onClick={startRecording}
                title="Record a voice message"
              >
                <Mic size={18} />
              </button>
            ) : (
              <button
                aria-label="Send message"
                className="send-button"
                disabled={disabled || busy}
                onClick={sendText}
                title="Send message"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      )}
      {!recording && !recordedAudio && (
        <div className="composer-caption">
          <span><ImageIcon size={12} /> Images up to 15 MB</span>
          <span>Press <kbd>Enter</kbd> to send</span>
        </div>
      )}
    </div>
  );
}
