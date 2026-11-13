/* global __dirname, Buffer */
const fs = require('fs');
const {
  chromium,
} = require('C:/Users/vanek/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('path');
(async () => {
  const dir = __dirname;
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const data =
    'data:image/png;base64,' +
    fs.readFileSync(path.join(dir, 'friendly-poses.png')).toString('base64');
  await page.setContent(
    '<html><body style="margin:0"><canvas id="c" width="1280" height="720"></canvas></body></html>',
  );
  const result = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = data;
    await image.decode();
    const c = document.getElementById('c'),
      ctx = c.getContext('2d');
    const draw = (t) => {
      ctx.fillStyle = '#fff0d6';
      ctx.fillRect(0, 0, 1280, 720);
      const sequence = [0, 1, 3, 1, 2, 3, 1, 0];
      for (let row = 0; row < 2; row++) {
        const index = sequence[Math.floor(t * 4 + row * 2) % sequence.length];
        const bob = Math.sin(t * Math.PI * 2) * 4;
        ctx.drawImage(
          image,
          (index * image.width) / 4,
          (row * image.height) / 2,
          image.width / 4,
          image.height / 2,
          65 + row * 620,
          80 + bob,
          550,
          550,
        );
      }
    };
    draw(0);
    const types = ['video/mp4;codecs=avc1.42001E', 'video/webm;codecs=vp9', 'video/webm'];
    const mime = types.find((x) => MediaRecorder.isTypeSupported(x));
    const stream = c.captureStream(24),
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const ended = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();
    const start = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        const t = (now - start) / 1000;
        draw(Math.min(t, 8));
        if (t < 8) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    recorder.stop();
    await ended;
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: mime });
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
    draw(0.4);
    return { mime, base64 };
  }, data);
  const ext = result.mime.includes('mp4') ? 'mp4' : 'webm';
  const output = path.join(dir, 'friendly-q-mascots.' + ext);
  fs.writeFileSync(output, Buffer.from(result.base64, 'base64'));
  await page.screenshot({ path: path.join(dir, 'preview.png') });
  const probe = await page.evaluate(async ({ base64, mime }) => {
    const v = document.createElement('video');
    v.src = 'data:' + mime + ';base64,' + base64;
    await new Promise((res, rej) => {
      v.onloadeddata = res;
      v.onerror = rej;
    });
    v.currentTime = 4;
    await new Promise((res) => (v.onseeked = res));
    return { width: v.videoWidth, height: v.videoHeight, decodedFrame: !v.error };
  }, result);
  console.log(JSON.stringify({ output, bytes: fs.statSync(output).size, ...probe }));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
