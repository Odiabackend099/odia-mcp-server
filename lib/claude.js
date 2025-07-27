import axios from 'axios';

const API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Send a message to Claude and return the response text.
 *
 * @param {string} prompt - The user’s prompt.
 * @param {string} [assistantPrompt] - Optional system instruction.
 * @returns {Promise<string>}
 */
export async function chatWithClaude(prompt, assistantPrompt = '') {
  const { CLAUDE_API_KEY, CLAUDE_MODEL_ID } = process.env;
  if (!CLAUDE_API_KEY) {
    throw new Error('Missing CLAUDE_API_KEY environment variable');
  }
  const messages = [];
  if (assistantPrompt) {
    messages.push({ role: 'assistant', content: assistantPrompt });
  }
  messages.push({ role: 'user', content: prompt });
  const payload = {
    model: CLAUDE_MODEL_ID || 'claude-3-sonnet-20240229',
    max_tokens: 1024,
    messages,
  };
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': CLAUDE_API_KEY,
    'anthropic-version': '2023-06-01',
  };
  try {
    const response = await axios.post(API_URL, payload, { headers });
    // Claude returns an array of content blocks. Grab the first one.
    const reply = response?.data?.content?.[0]?.text || '';
    return reply.trim();
  } catch (error) {
    console.error('Claude API error:', error?.response?.data || error?.message || error);
    throw new Error('Failed to fetch response from Claude');
  }
}

/**
 * Generate an onboarding message for a customer.
 *
 * This helper crafts a friendly greeting instructing the user
 * on next steps. It delegates to `chatWithClaude` using a
 * structured prompt.
 *
 * @param {object} customerInfo
 * @returns {Promise<string>}
 */
export async function generateOnboardingResponse(customerInfo) {
  const userPrompt = `You are Agent Lexi, a helpful onboarding agent. Onboard the new customer with the following info: ${JSON.stringify(
    customerInfo,
  )}. Provide a friendly greeting and next steps.`;
  return chatWithClaude(userPrompt);
}
