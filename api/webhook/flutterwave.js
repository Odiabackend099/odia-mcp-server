import { validateWebhookSignature, verifyTransaction } from '../../lib/utils.js';
import { generateOnboardingResponse } from '../../lib/claude.js';
import { supabaseService } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

/**
 * Disable Vercel's built‑in body parser for this route so we can access
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
 * 💳 FLUTTERWAVE WEBHOOK HANDLER
 *
 * This endpoint consumes payment notifications from Flutterwave, validates
 * the signature, verifies the transaction status via Flutterwave's API,
 * triggers onboarding using Claude and records the event in Supabase.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || Date.now().toString();

  try {
    // 🌐 Handle GET requests (browser visits) gracefully
    if (req.method && req.method.toUpperCase() === 'GET') {
      logger.info('Webhook endpoint accessed via browser', { requestId });
      
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        service: 'ODIA AI Flutterwave Webhook',
        status: '✅ Webhook endpoint is operational',
        message: 'This endpoint processes Flutterwave payment notifications via POST requests',
        timestamp: new Date().toISOString(),
        documentation: {
          method: 'POST',
          contentType: 'application/json',
          requiredHeaders: ['verif-hash'],
          description: 'Secure webhook for processing payment confirmations'
        },
        health: {
          responseTime: `${Date.now() - startTime}ms`,
          environment: process.env.NODE_ENV || 'development'
        }
      }, null, 2));
      return;
    }

    // ❌ Only allow POST requests for actual webhook processing
    if (req.method && req.method.toUpperCase() !== 'POST') {
      logger.warn('Invalid method attempted on webhook', { 
        method: req.method, 
        requestId,
        ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
      });
      
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Method Not Allowed',
        message: 'This webhook only accepts POST requests from Flutterwave',
        allowedMethods: ['POST'],
        requestId
      }));
      return;
    }

    logger.info('Processing Flutterwave webhook', { requestId });

    // 📖 Read the raw body from the request stream
    let rawBody = '';
    try {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      rawBody = Buffer.concat(buffers).toString();
      
      if (!rawBody || rawBody.length === 0) {
        throw new Error('Empty request body received');
      }
    } catch (err) {
      logger.error('Failed to read webhook body', { 
        error: err.message, 
        requestId 
      });
      
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Failed to read request body',
        requestId
      }));
      return;
    }

    // 🔐 Validate webhook signature
    const isValidSignature = validateWebhookSignature(req, rawBody);
    if (!isValidSignature) {
      logger.securityEvent('Invalid webhook signature', {
        requestId,
        ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent']
      });
      
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Invalid signature',
        message: 'Webhook signature validation failed',
        requestId
      }));
      return;
    }

    // 📋 Parse the JSON payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      logger.error('Invalid JSON payload in webhook', { 
        error: err.message, 
        requestId,
        rawBodyLength: rawBody.length
      });
      
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Invalid JSON payload',
        requestId
      }));
      return;
    }

    const { data } = payload || {};
    const transactionId = data?.id || data?.tx_ref;

    if (!transactionId) {
      logger.error('Missing transaction ID in webhook payload', { 
        requestId,
        hasData: !!data,
        payloadKeys: Object.keys(payload || {})
      });
      
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Missing transaction ID',
        requestId
      }));
      return;
    }

    logger.info('Processing transaction', { transactionId, requestId });

    // 🔍 Verify transaction with Flutterwave API
    let verifyResponse;
    try {
      verifyResponse = await verifyTransaction(transactionId);
    } catch (err) {
      logger.error('Transaction verification failed', { 
        error: err.message, 
        transactionId, 
        requestId 
      });
      
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Transaction verification failed',
        requestId
      }));
      return;
    }

    const status = verifyResponse?.data?.status;
    
    if (status !== 'successful') {
      logger.info('Transaction not yet successful', { 
        status, 
        transactionId, 
        requestId 
      });
      
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        message: 'Transaction not successful yet',
        status: status,
        transactionId,
        requestId
      }));
      return;
    }

    // 👤 Extract customer information
    const customerInfo = {
      name: data?.customer?.name || 'Unknown Customer',
      email: data?.customer?.email || '',
      phone: data?.customer?.phone_number || '',
      amount: data?.amount || 0,
      currency: data?.currency || 'NGN',
      tx_ref: transactionId,
      payment_method: data?.payment_type || 'unknown'
    };

    logger.info('Successful payment processed', { 
      customerEmail: customerInfo.email,
      amount: customerInfo.amount,
      currency: customerInfo.currency,
      transactionId,
      requestId
    });

    // 🤖 Generate AI-powered onboarding message
    let onboardingMsg = '';
    try {
      onboardingMsg = await generateOnboardingResponse(customerInfo);
    } catch (err) {
      logger.error('Onboarding message generation failed', { 
        error: err.message, 
        transactionId, 
        requestId 
      });
      
      // Use fallback message if AI fails
      onboardingMsg = `Welcome ${customerInfo.name}! Thank you for your payment of ${customerInfo.currency} ${customerInfo.amount}. Our team will contact you shortly to complete your onboarding.`;
    }

    // 💾 Store onboarding event in database
    try {
      await supabaseService
        .from('onboarding_events')
        .insert({
          customer_info: customerInfo,
          message: onboardingMsg,
          request_id: requestId,
          transaction_id: transactionId,
          payment_status: status,
          created_at: new Date().toISOString(),
        });
      
      logger.info('Onboarding event saved successfully', { 
        transactionId, 
        requestId 
      });
    } catch (error) {
      logger.error('Failed to save onboarding event', { 
        error: error.message, 
        transactionId, 
        requestId 
      });
      // Don't fail the webhook if database save fails
    }

    // ✅ Send successful response
    const responseTime = Date.now() - startTime;
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      success: true,
      message: 'Webhook processed successfully', 
      onboardingMsg,
      customerInfo: {
        name: customerInfo.name,
        email: customerInfo.email,
        amount: customerInfo.amount,
        currency: customerInfo.currency
      },
      transactionId,
      requestId,
      processingTime: `${responseTime}ms`
    }));

    logger.info('Webhook processed successfully', { 
      transactionId, 
      requestId, 
      responseTime 
    });

  } catch (err) {
    logger.error('Webhook processing error', { 
      error: err.message, 
      stack: err.stack, 
      requestId 
    });
    
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      error: 'Internal server error',
      requestId,
      timestamp: new Date().toISOString()
    }));
  }
}
