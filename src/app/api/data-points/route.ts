import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { Ai } from '@cloudflare/ai';

export const runtime = 'edge';

interface DataPoint {
  id: number;
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log(await await getRequestContext().env.AI);
    const ai = new Ai(getRequestContext().env.AI);

    const body: DataPoint = await request.json();

    const { text } = body;
    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const { results } = await getRequestContext()
      .env.DB.prepare('INSERT INTO datapoints (text) VALUES (?) RETURNING *')
      .bind(text)
      .all<DataPoint>();

    const record = results.length ? results[0] : null;

    if (!record) {
      return NextResponse.json(
        { error: 'Failed to create note' },
        { status: 500 }
      );
    }

    const { data } = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: [text],
    });
    const values = data[0];

    if (!values) {
      return NextResponse.json(
        { error: 'Failed to generate vector embedding' },
        { status: 500 }
      );
    }

    const { id } = record;
    const inserted = await getRequestContext().env.VECTORIZE_INDEX.upsert([
      {
        id: id.toString(),
        values,
      },
    ]);

    return NextResponse.json({ id, text, inserted });
  } catch (error: any) {
    console.log(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
