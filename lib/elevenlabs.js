import axios from 'axios';

/**
 * Synthesize speech using the ElevenLabs API.
 *
 * Sends the provided text to ElevenLabs and returns a data URI
 * containing the MP3 audio. Requires both the voice ID and API key to
 * be set via environment variables. See the ElevenLabs documentation
 * for additional voice settings.
 *
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function synthesizeSpeech(text) {
  const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = process.env;
  if (!ELEVENLABS_VOICE_ID) {
    throw new Error('Missing ELEVENLABS_VOICE_ID environment variable');
  }
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;
  try {
    const response = await axios.post(
      url,
      {
        text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY || '',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
      },
    );
    const buffer = Buffer.from(response.data, 'binary');
    const base64Audio = buffer.toString('base64');
    return `data:audio/mpeg;base64,${base64Audio}`;
  } catch (error) {
    console.error('ElevenLabs API error:', error?.response?.data || error?.message || error);
    throw new Error('Failed to synthesize speech');
  }
}
