import { requireUser } from './_lib/auth.js'

export const config = { runtime: 'edge' }

const SYSTEM_PROMPT = `You are helping a young child create an exciting comic book.
The child has narrated a scene from his story. Your job is to:
1. Fix any unclear or fragmented sentences
2. Complete unfinished thoughts
3. Add vivid, exciting comic-book style language
4. Keep his original ideas and excitement — do not change what happens
5. Keep it age-appropriate and fun
6. Match the energy of Dragon Ball Z / action anime
Output ONLY the enhanced narration. 2-3 sentences maximum.`

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method not allowed' }, { status: 405 })
  }

  const userId = await requireUser(req.headers.get('authorization'))
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { raw_transcription } = (await req.json()) as { raw_transcription?: string }
  if (!raw_transcription || !raw_transcription.trim()) {
    return Response.json({ error: 'raw_transcription is required' }, { status: 400 })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: raw_transcription },
        ],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      console.error('enhance: openai error', await response.text())
      return Response.json({ error: 'enhancement failed' }, { status: 500 })
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const enhanced_narration = data.choices?.[0]?.message?.content?.trim()
    if (!enhanced_narration) {
      return Response.json({ error: 'enhancement failed' }, { status: 500 })
    }

    return Response.json({ enhanced_narration })
  } catch (err) {
    console.error('enhance error', err)
    return Response.json({ error: 'enhancement failed' }, { status: 500 })
  }
}
