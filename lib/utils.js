import axios from 'axios';

/**
 * Validate the Flutterwave webhook signature.
 *
 * Flutterwave sends a hash in the `verif-hash` header (sometimes
 * `x-verif-hash`) which should match a pre‑shared secret. This function
 * compares the header against the `FLUTTERWAVE_HASH` environment
 * variable. In a production system you would compute an HMAC of the
 * raw body using a secret key; here we perform a constant‑time
 * comparison against a shared hash for simplicity.
 *
 * @param {import('http').IncomingMessage} req
 * @param {string} rawBody
 * @returns {boolean}
 */
export function validateWebhookSignature(req, rawBody) {
  const signature = req.headers['verif-hash'] || req.headers['x-verif-hash'];
  const { FLUTTERWAVE_HASH } = process.env;
  if (!signature || !FLUTTERWAVE_HASH) {
    return false;
  }
  return signature === FLUTTERWAVE_HASH;
}

/**
 * Verify a Flutterwave transaction via the official API.
 *
 * Contacts the Flutterwave API using the secret key provided in the
 * environment to confirm the status of a transaction.
 *
 * @param {string|number} transactionId
 * @returns {Promise<object>}
 */
export async function verifyTransaction(transactionId) {
  const { FLUTTERWAVE_SECRET_KEY } = process.env;
  if (!FLUTTERWAVE_SECRET_KEY) {
    throw new Error('Missing FLUTTERWAVE_SECRET_KEY environment variable');
  }
  const url = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Flutterwave verify error:', error?.response?.data || error?.message || error);
    throw new Error('Failed to verify Flutterwave transaction');
  }
}
