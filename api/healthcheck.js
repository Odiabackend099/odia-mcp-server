/**
 * Healthcheck endpoint for the ODIA MCP backend.
 * Returns a simple success message when the server is running.
 */
export default function handler(req, res) {
  // Only allow GET requests for this endpoint
  if (req.method && req.method.toUpperCase() !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }
  // Respond with a plain text success message
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('ODIA MCP Server is Live \u2705');
}
