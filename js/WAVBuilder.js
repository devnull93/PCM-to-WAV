function encodeWAV(float32array, sampleRate) {
   const samples = float32array;
   const sampleCount = samples.length;
   const bytesPerSample = 2;
   const blockAlign = bytesPerSample;
   const byteRate = sampleRate * blockAlign;
   const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
   const view = new DataView(buffer);

   function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
           view.setUint8(offset + i, string.charCodeAt(i));
      }
   }

   writeString(view, 0, "RIFF");
   view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
   writeString(view, 8, "WAVE");
   writeString(view, 12, "fmt ");
   view.setUint32(16, 16, true);
   view.setUint16(20, 1, true);
   view.setUint16(22, 1, true);
   view.setUint32(24, sampleRate, true);
   view.setUint32(28, byteRate, true);
   view.setUint16(32, blockAlign, true);
   view.setUint16(34, bytesPerSample * 8, true);
   writeString(view, 36, "data");
   view.setUint32(40, sampleCount * bytesPerSample, true);

   let offset = 44;
   for (let i = 0; i < sampleCount; i++) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, s, true);
        offset += 2;
   }

   return new Blob([view], {
        type: "audio/wav"
   });
}