"use client";
import { useState, useRef, useEffect } from "react";
import "../globals.css";
import * as WavEncoder from "wav-encoder";

export default function VoiceRecord() {
  const [recording, setRecording] = useState(false);
  const [recordingClicked, setRecordingClicked] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownInput, setCountdownInput] = useState<number>(1);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [timer, setTimer] = useState(0); // To store the elapsed time
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null); // To store the interval ID

  function startCountdown() {
    setRecordingClicked(true);
    if (countdownInput <= 0) return;
    setCountdown(countdownInput);
    let count = countdownInput;
    const interval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count === 0) {
        clearInterval(interval);
        setCountdown(null);
        startRecording();
      }
    }, 1000);
  }

  async function startRecording() {
    setTimer(0); // Reset the timer when starting recording
    const id = setInterval(() => {
      setTimer((prevTime) => prevTime + 1); // Increment timer every second
    }, 1000);
    setIntervalId(id);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };


        mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const arrayBuffer = reader.result;

            const audioContext = new (window.AudioContext);
            
            try {
                // Decode the audio data into an AudioBuffer
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer as ArrayBuffer);
            
                // Define the duration to trim to (in seconds)
                const trimDuration = 5;
                const trimEndTime = Math.min(trimDuration, audioBuffer.duration); // Ensure we don't exceed the original duration
            
                // Create a new AudioBuffer for the trimmed portion
                const trimmedBuffer = audioContext.createBuffer(
                audioBuffer.numberOfChannels, 
                trimEndTime * audioBuffer.sampleRate, 
                audioBuffer.sampleRate
                );
            
                // Copy data from the original AudioBuffer to the trimmed one
                for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const originalChannelData = audioBuffer.getChannelData(channel);
                const trimmedChannelData = trimmedBuffer.getChannelData(channel);
                trimmedChannelData.set(originalChannelData.slice(0, trimEndTime * audioBuffer.sampleRate));
                }
            
                // Convert the trimmed AudioBuffer to WAV (using wav-encoder library)
                const wavData = await WavEncoder.encode({
                sampleRate: trimmedBuffer.sampleRate,
                channelData: Array.from({ length: trimmedBuffer.numberOfChannels }, (_, channel) => trimmedBuffer.getChannelData(channel))
                });
            
                // Create a Blob from the WAV data
                const wavBlob = new Blob([wavData], { type: "audio/wav" });
                const wavUrl = URL.createObjectURL(wavBlob);
            
                // Set the new URL to the state or perform any other actions
                setAudioUrl(wavUrl);
            
            } catch (err) {
                console.error("Error decoding or processing audio data", err);
            }
            
        };

        reader.readAsArrayBuffer(audioBlob);
        };
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  }

  function stopRecording() {
    // Delay stopping the recording to avoid capturing the click sound
    setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      
    }, 0);
    setRecording(false);
      setRecordingClicked(false);
  }
  

  function deleteRecording() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }

  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId); // Clean up when the component is unmounted
      }
    };
  }, [intervalId]);

  return (
    <div className="flex flex-col font-[family-name:var(--font-geist-sans)] text-center p-4">
      <label>Input the Countdown number before Recording Starts</label>
      <input
        type="number"
        min="1"
        value={countdownInput}
        onChange={(e) => setCountdownInput(Number(e.target.value))}
        className="border p-2 rounded mb-2 text-center m-auto"
      />
      <button className="start-recording-button m-auto mb-2" onClick={recording ? stopRecording : startCountdown}>
        {recording ? "Stop Recording" : "Start Recording With Countdown"}
      </button>
      <button className="start-recording-button m-auto mb-2" onClick={recording ? stopRecording : startRecording}>
        {recording ? "Stop Recording" : "Start Recording"}
      </button>
      {recording && (
        <div className="timer">
          Recording Time: {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
        </div>
      )}

      {countdown !== null && (
        <div key={countdown} className="fade-animation text-lg font-bold mt-2">
          {countdown}
        </div>
      )}

      {recording && <div className="mt-2">🎙️ Recording in progress...</div>}

      {audioUrl && !recordingClicked && (
        <div className="mt-4 flex flex-col items-center">
          <audio controls src={audioUrl} className="mb-2" />
          <div className="flex gap-4">
            <a
              href={audioUrl}
              download="recording.webm"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              ⬇️ Download
            </a>
            <button
              onClick={deleteRecording}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .fade-animation {
          animation: fade 1s ease-in-out;
        }
        @keyframes fade {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
