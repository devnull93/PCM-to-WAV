    let currentTab = "file";
    let fileBuffer = null;
    let presetFloatArray = null;
    let activeWavUrl = null;

    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const fileDetails = document.getElementById("file-details");
    const fileNameEl = document.getElementById("file-name");
    const fileSizeEl = document.getElementById("file-size");
    const textInput = document.getElementById("text-input");
    const sampleRateSelect = document.getElementById("sample-rate");
    const pcmTypeSelect = document.getElementById("pcm-type");
    const audioPlayer = document.getElementById("audio-player");
    const downloadBtn = document.getElementById("download-btn");
    const statusBadge = document.getElementById("status-badge");
    const canvas = document.getElementById("waveform-canvas");
    const canvasPlaceholder = document.getElementById("canvas-placeholder");
    const convertBtn = document.getElementById("convert-btn");

    function switchTab(tabId) {
       currentTab = tabId;

       document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active"));
       document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));

       event.currentTarget.classList.add("active");
       document.getElementById(`tab-${tabId}`).classList.add("active");
    }

    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("dragover", (e) => {
       e.preventDefault();
       dropZone.classList.add("dragover");
    });

    ["dragleave", "drop"].forEach(event => {
       dropZone.addEventListener(event, () => dropZone.classList.remove("dragover"));
    });

    dropZone.addEventListener("drop", (e) => {
       e.preventDefault();
       if (e.dataTransfer.files.length) {
           handleFileSelection(e.dataTransfer.files[0]);
       }
    });

   fileInput.addEventListener("change", (e) => {
      if (e.target.files.length) {
          handleFileSelection(e.target.files[0]);
      }
   });

   function handleFileSelection(file) {
      fileNameEl.textContent = file.name;
      fileSizeEl.textContent = (file.size / 1024).toFixed(1) + " KB";
      fileDetails.classList.add("visible");

      const reader = new FileReader();
      reader.onload = (e) => {
         fileBuffer = e.target.result;
         updateStatus("File Loaded", true);
      };
      reader.readAsArrayBuffer(file);
   }

   function loadPreset(type) {
      const sampleRate = parseInt(sampleRateSelect.value, 10);
      const duration = 1.0;
      const totalSamples = Math.floor(sampleRate * duration);
      const floatArray = new Float32Array(totalSamples);

      if (type === "sine") {
          for (let i = 0; i < totalSamples; i++) {
               floatArray[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate));
          }
      } else if (type === "chord") {
          const freqs = [ 440, 554.37, 659.25 ];
          for (let i = 0; i < totalSamples; i++) {
               const t = i / sampleRate;
               floatArray[i] = (
                    Math.sin(2 * Math.PI * freqs[0] * t) +
                    Math.sin(2 * Math.PI * freqs[1] * t) +
                    Math.sin(2 * Math.PI * freqs[2] * t)
               ) / 3;
          }
      } else if (type === "sweep") {
          for (let i = 0; i < totalSamples; i++) {
               const t = i / sampleRate;
               const freq = 200 + (1800 * t);
               floatArray[i] = Math.sin(2 * Math.PI * freq * t);
          }
      } else if (type === "noise") {
          for (let i = 0; i < totalSamples; i++) {
               floatArray[i] = Math.random() * 2 - 1;
          }
      }

      presetFloatArray = floatArray;
      updateStatus(`Preset: ${type}`, true);
      convertPcmToWav();
   }

   function parseToFloat32Array() {
      if (currentTab === "file") {
          if (!fileBuffer) {
              alert("Please upload a PCM binary file first.");
              return null;
          }

          const encoding = pcmTypeSelect.value;
          if (encoding === "float32") {
              try {
                   return new Float32Array(fileBuffer);
              } catch(err) {
                   alert(`Error: ${err.message}`);
              }
          } else if (encoding === "int16") {
              const int16 = new Int16Array(fileBuffer);
              const float32 = new Float32Array(int16.length);
              for (let i = 0; i < int16.length; i++) {
                   float32[i] = int16[i] / (int16[i] < 0 ? 32768 : 32767);
              }
              return float32;
          } else if (encoding === "int8") {
              const uint8 = new Uint8Array(fileBuffer);
              const float32 = new Float32Array(uint8.length);
              for (let i = 0; i < uint8.length; i++) {
                   float32[i] = (uint8[i] - 128) / 128;
              }
              return float32;
          }
      } else if (currentTab === "text") {
          const text = textInput.value.trim();
          if (!text) {
              alert("Please enter sample array values.");
              return null;
          }

          const matches = text.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
          if (!matches) {
              alert("No valid numbers found in the text input.");
              return null;
          }
          return new Float32Array(matches.map(Number));
      } else if (currentTab === "preset") {
          if (!presetFloatArray) {
              loadPreset("sine");
          }
          return presetFloatArray;
      }
      return null;
   }

   function convertPcmToWav() {
      const float32Data = parseToFloat32Array();
      if (!float32Data || float32Data.length === 0) return;

      const sampleRate = parseInt(sampleRateSelect.value, 10);
      const wavBlob = encodeWAV(float32Data, sampleRate);

      if (activeWavUrl) {
          URL.revokeObjectURL(activeWavUrl);
      }

      activeWavUrl = URL.createObjectURL(wavBlob);
      audioPlayer.src = activeWavUrl;

      downloadBtn.href = activeWavUrl;
      downloadBtn.download = `WAV_OUTPUT_${sampleRate}Hz.wav`;
      downloadBtn.style.pointerEvents = "auto";
      downloadBtn.style.opacity = "1";

      document.getElementById("meta-samples").textContent = float32Data.length.toLocaleString();
      document.getElementById("meta-duration").textContent = (float32Data.length / sampleRate).toFixed(2) + " s";
      document.getElementById("meta-size").textContent = (wavBlob.size / 1024).toFixed(1) + " KB";

      drawWaveform(float32Data);
      updateStatus("WAV Encoded", true);
   }

   function drawWaveform(samples) {
      canvasPlaceholder.style.display = "none";
      const ctx = canvas.getContext("2d");
      const DPR = window.devicePixelRatio || 1;

      canvas.width = canvas.parentElement.clientWidth * DPR;
      canvas.height = canvas.parentElement.clientHeight * DPR;
      ctx.scale(DPR, DPR);

      const width = canvas.parentElement.clientWidth;
      const height = canvas.parentElement.clientHeight;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#6366F1");
      gradient.addColorStop(0.5, "#C084FC");
      gradient.addColorStop(1, "#F472B6");

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = gradient;
      ctx.beginPath();

      const step = Math.max(1, Math.floor(samples.length / width));
      for (let i = 0; i < width; i++) {
           const sampleIdx = Math.floor(i * (samples.length / width));
           let min = 1.0;
           let max = -1.0;

           for (let j = 0; j < step && (sampleIdx + j) < samples.length; j++) {
                const val = samples[sampleIdx + j];
                if (val < min) min = val;
                if (val > max) max = val;
           }

           const yMin = centerY + (min * centerY * 0.85);
           const yMax = centerY + (max * centerY * 0.85);

           ctx.moveTo(i, yMin);
           ctx.lineTo(i, yMax);
      }

      ctx.stroke();
   }

   function updateStatus(text, isActive) {
      statusBadge.textContent = text;
      if (isActive) {
          statusBadge.classList.add("active");
      } else {
          statusBadge.classList.remove("active");
      }
   }