import { chatWithClaude } from '../../lib/claude.js';
import { synthesizeSpeech } from '../../lib/elevenlabs.js';
import { supabaseService } from '../../lib/supabase.js';

/**
 * Voice Lexi endpoint.
 *
 * Accepts a JSON payload containing a `message` and an optional
 * `conversationId`. The message is sent to Claude and the reply is
 * synthesized to speech. Conversation history is stored in Supabase.
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
  // Parse body
  let body;
  try {
    body = req.body || {};
  } catch (e) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    try {
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
  }
  const { message, conversationId } = body;
  if (!message) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'message is required in the request body' }));
    return;
  }
  try {
    const reply = await chatWithClaude(message);
    const audio = await synthesizeSpeech(reply);
    // Persist conversation to Supabase.
    try {
      await supabaseService
        .from('conversations')
        .insert({
          conversation_id: conversationId || null,
          user_message: message,
          ai_reply: reply,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Supabase conversation insert error:', error.message || error);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ reply, audio }));
  } catch (error) {
    console.error('Voice Lexi error:', error?.message || error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to process voice request' }));
  }
}
