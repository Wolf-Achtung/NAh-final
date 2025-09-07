// server/routes/stt.ts
//
// Speech‑to‑text route for the NAh‑final application. Accepts an audio
// file uploaded via multipart/form-data and returns a JSON payload
// containing the transcribed text. This sample implementation uses
// OpenAI Whisper through the openai API, but you can swap in your
// favourite STT provider. The route stores the uploaded file to a
// temporary location and streams it to the API.

import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Ensure you set OPENAI_API_KEY in your environment. In production
// you might also set organization or other options here.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// POST /api/stt
router.post('/api/stt', upload.single('file'), async (req, res) => {
  try {
    // Validate presence of file
    if (!req.file) {
      return res.status(400).json({ error: 'missing file' });
    }
    // Write the uploaded WebM file to a temporary location. The tmp
    // directory is ideal for scratch files.
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `${Date.now()}-voice.webm`);
    await fs.writeFile(tmpPath, req.file.buffer);
    // Choose the appropriate language. You can forward 'lang' from
    // client to set the language hint for Whisper. Defaults to 'de'.
    const lang = typeof req.body.lang === 'string' ? req.body.lang : 'de';
    // Call OpenAI Whisper API. If you wish to use a different
    // transcription model, adjust accordingly.
    const tr = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath) as any,
      model: 'whisper-1',
      language: lang
    });
    // Clean up temp file
    await fs.unlink(tmpPath).catch(() => {});
    res.json({ text: tr.text || '' });
  } catch (err: any) {
    console.error('STT error', err);
    res.status(500).json({ error: err.message || 'stt-failed' });
  }
});

export default router;