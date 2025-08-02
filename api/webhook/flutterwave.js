import { validateWebhookSignature, verifyTransaction } from '../../lib/utils.js';
import { generateOnboardingResponse } from '../../lib/claude.js';
import { supabaseService } from '../../lib/supabase.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Handle GET requests for testing
  if (req.method && req.method.toUpperCase() === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: '✅ Flutterwave Webhook Endpoint Ready',
      method: 'POST required for actual webhooks',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (req.method && req.method.toUpperCase() !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let rawBody = '';
  try {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    rawBody = Buffer.concat(buffers).toString();
  } catch (err) {
    console.error('Failed to read webhook body:', err?.message || err);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to read request body' }));
    return;
  }

  // Skip signature validation if no hash is configured
  const { FLUTTERWAVE_HASH } = process.env;
  if (FLUTTERWAVE_HASH && !validateWebhookSignature(req, rawBody)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid signature' }));
    return;
  }

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
    // Skip transaction verification if no secret key
    const { FLUTTERWAVE_SECRET_KEY } = process.env;
    if (!FLUTTERWAVE_SECRET_KEY) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        message: 'Webhook received but payment verification disabled',
        transactionId 
      }));
      return;
    }

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
    res.end(JSON.stringify({ 
      message: 'Webhook processed successfully', 
      onboardingMsg 
    }));
    
  } catch (err) {
    console.error('Webhook processing error:', err?.message || err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
