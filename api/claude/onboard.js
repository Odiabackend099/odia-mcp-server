import { generateOnboardingResponse, chatWithClaude } from '../../lib/claude.js';
import { synthesizeSpeech } from '../../lib/elevenlabs.js';
import { supabaseService } from '../../lib/supabase.js';

/**
 * Onboard a new customer using Claude.
 *
 * This endpoint expects a JSON body containing a `customerInfo` object.
 * Optionally, you can trigger a text‑to‑speech response by passing
 * `tts=true` as a query parameter. The onboarding message is stored
 * in Supabase along with the provided customer information.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.method && req.method.toUpperCase() !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }
  // Extract JSON body. Vercel automatically parses JSON unless bodyParser is disabled.
  let body;
  try {
    body = req.body || {};
  } catch (e) {
    // Fallback: attempt to read the request stream if body isn’t already parsed.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    try {
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
  }
  const { customerInfo } = body;
  const query = req.query || {};
  const useTTS = query.tts === 'true' || query.tts === '1';
  if (!customerInfo) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'customerInfo is required in the request body' }));
    return;
  }
  try {
    const onboardingMsg = await generateOnboardingResponse(customerInfo);
    // Persist onboarding event to Supabase.
    try {
      await supabaseService
        .from('onboarding_events')
        .insert({
          customer_info: customerInfo,
          message: onboardingMsg,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      // Log Supabase insertion errors but do not fail the request.
      console.error('Supabase onboarding insert error:', error.message || error);
    }
    let audio;
    if (useTTS) {
      audio = await synthesizeSpeech(onboardingMsg);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ onboardingMsg, audio }));
  } catch (error) {
    console.error('Onboarding error:', error?.message || error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to generate onboarding message' }));
  }
}
