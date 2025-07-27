import { validateWebhookSignature, verifyTransaction } from '../../../lib/utils.js';
import { generateOnboardingResponse } from '../../../lib/claude.js';
import { supabaseService } from '../../../lib/supabase.js';

/**
 * Disable Vercel’s built‑in body parser for this route so we can access
 * the raw request body to validate the Flutterwave signature. Without
 * this config the body would be parsed and mutated before we can
 * compute the HMAC.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Flutterwave webhook handler.
 *
 * This endpoint consumes payment notifications from Flutterwave, validates
 * the signature, verifies the transaction status via Flutterwave’s API,
 * triggers onboarding using Claude and records the event in Supabase.
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
  // Read the raw body from the request stream.
  let rawBody = '';
  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    rawBody = Buffer.concat(buffers).toString();
  } catch (err) {
    console.error('Failed to read webhook body:', err?.message || err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to read request body' }));
    return;
  }
  // Validate signature using the raw body.
  if (!validateWebhookSignature(req, rawBody)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid signature' }));
    return;
  }
  // Parse the JSON payload.
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    return;
  }
  const { data } = payload || {};
  const transactionId = data?.id || data?.tx_ref;
  try {
    const verifyResponse = await verifyTransaction(transactionId);
    const status = verifyResponse?.data?.status;
    if (status !== 'successful') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: 'Transaction not successful yet' }));
      return;
    }
    const customerInfo = {
      name: data?.customer?.name,
      email: data?.customer?.email,
      phone: data?.customer?.phone_number,
      amount: data?.amount,
      currency: data?.currency,
      tx_ref: transactionId,
    };
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
      console.error('Supabase webhook insert error:', error.message || error);
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Webhook processed successfully', onboardingMsg }));
  } catch (err) {
    console.error('Webhook processing error:', err?.message || err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
