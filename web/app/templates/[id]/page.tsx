'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

type TextRole = 'headline' | 'caption' | 'cta' | 'static';
type TemplateText = {
  type: 'text';
  role: TextRole;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fill: string;
  fontWeight: '400' | '700';
  align: 'right' | 'center' | 'left';
};
type TemplateRect = { type: 'rect'; x: number; y: number; width: number; height: number; fill: string; radius: number };
type TemplateImage = { type: 'image'; role: 'logo'; x: number; y: number; width: number; height: number };
type TemplateObject = TemplateText | TemplateRect | TemplateImage;
type TemplateDocument = { width: number; height: number; background: string; objects: TemplateObject[] };

const ROLE_LABEL: Record<string, string> = {
  headline: 'العنوان',
  caption: 'النص',
  cta: 'الزر',
  static: 'نص ثابت',
  logo: 'الشعار',
  rect: 'شكل',
};

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [name, setName] = useState('');
  const [published, setPublished] = useState(false);
  const [document, setDocument] = useState<TemplateDocument | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void fetch(`/api/nest/templates/${id}`).then(async (response) => {
      if (response.status === 401) {
        setError('افتح الاستوديو وسجّل الدخول أولاً.');
        return;
      }
      if (!response.ok) {
        setError('تعذر فتح القالب.');
        return;
      }
      const body = (await response.json()) as { name: string; published: boolean; document: TemplateDocument };
      setName(body.name);
      setPublished(body.published);
      setDocument(body.document);
    });
  }, [id]);

  function updateObject(index: number, next: TemplateObject) {
    setDocument((current) => {
      if (!current) {
        return current;
      }
      const objects = current.objects.map((object, item) => (item === index ? next : object));
      return { ...current, objects };
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!document) {
      return;
    }
    setError('');
    setNotice('جارٍ الحفظ…');
    const response = await fetch(`/api/nest/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, published, document }),
    });
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      setNotice('');
      setError(body.message || 'تعذر حفظ القالب.');
      return;
    }
    setNotice(published ? 'تم الحفظ. القالب منشور للتجار.' : 'تم الحفظ كمسودة.');
  }

  const object = document?.objects[selected];

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="page-title">تعديل القالب</h1>
        <Link href="/templates">العودة للقوالب</Link>
      </div>
      {!document ? <p>{error || 'جارٍ فتح القالب…'}</p> : null}
      {document ? (
        <form className="editor-layout" onSubmit={save}>
          <div className="toolbar panel">
            <label>
              الاسم
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="row">
              <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
              منشور للتجار
            </label>
            <label>
              لون الخلفية
              <input value={document.background} onChange={(event) => setDocument({ ...document, background: event.target.value })} />
            </label>
            <div className="row">
              {document.objects.map((item, index) => (
                <button key={index} type="button" onClick={() => setSelected(index)}>
                  {index === selected ? '● ' : ''}
                  {item.type === 'text' ? ROLE_LABEL[item.role] : item.type === 'image' ? ROLE_LABEL.logo : ROLE_LABEL.rect}
                </button>
              ))}
            </div>
            {object ? <ObjectFields object={object} onChange={(next) => updateObject(selected, next)} /> : null}
            <button type="submit">حفظ القالب</button>
            {notice ? <p>{notice}</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </div>
          <div className="canvas-frame">
            <Preview document={document} />
          </div>
        </form>
      ) : null}
    </>
  );
}

function ObjectFields({ object, onChange }: { object: TemplateObject; onChange: (next: TemplateObject) => void }) {
  if (object.type === 'text') {
    return (
      <>
        <label>
          النص
          <textarea value={object.text} onChange={(event) => onChange({ ...object, text: event.target.value })} />
        </label>
        <label>
          اللون
          <input value={object.fill} onChange={(event) => onChange({ ...object, fill: event.target.value })} />
        </label>
        <label>
          الحجم
          <input type="number" value={object.fontSize} onChange={(event) => onChange({ ...object, fontSize: Number(event.target.value) })} />
        </label>
        <NumberPair object={object} onChange={onChange} />
      </>
    );
  }
  if (object.type === 'rect') {
    return (
      <>
        <label>
          اللون
          <input value={object.fill} onChange={(event) => onChange({ ...object, fill: event.target.value })} />
        </label>
        <NumberPair object={object} onChange={onChange} />
        <label>
          العرض
          <input type="number" value={object.width} onChange={(event) => onChange({ ...object, width: Number(event.target.value) })} />
        </label>
        <label>
          الارتفاع
          <input type="number" value={object.height} onChange={(event) => onChange({ ...object, height: Number(event.target.value) })} />
        </label>
      </>
    );
  }
  return <NumberPair object={object} onChange={onChange} />;
}

function NumberPair({
  object,
  onChange,
}: {
  object: TemplateObject;
  onChange: (next: TemplateObject) => void;
}) {
  return (
    <div className="row">
      <label>
        أفقي
        <input type="number" value={object.x} onChange={(event) => onChange({ ...object, x: Number(event.target.value) })} />
      </label>
      <label>
        رأسي
        <input type="number" value={object.y} onChange={(event) => onChange({ ...object, y: Number(event.target.value) })} />
      </label>
    </div>
  );
}

function Preview({ document }: { document: TemplateDocument }) {
  return (
    <svg viewBox={`0 0 ${document.width} ${document.height}`} width="100%" role="img" aria-label="معاينة القالب">
      <rect width={document.width} height={document.height} fill={document.background} />
      {document.objects.map((object, index) => {
        if (object.type === 'rect') {
          return <rect key={index} x={object.x} y={object.y} width={object.width} height={object.height} rx={object.radius} fill={object.fill} />;
        }
        if (object.type === 'image') {
          const radius = Math.min(object.width, object.height) / 2;
          return <circle key={index} cx={object.x + object.width / 2} cy={object.y + object.height / 2} r={radius} fill="#e5e7eb" />;
        }
        const anchor = object.align === 'center' ? 'middle' : object.align === 'left' ? 'start' : 'end';
        const x = object.align === 'center' ? object.x + object.width / 2 : object.align === 'left' ? object.x : object.x + object.width;
        return (
          <text
            key={index}
            x={x}
            y={object.y + object.fontSize}
            fill={object.fill}
            fontSize={object.fontSize}
            fontWeight={object.fontWeight}
            textAnchor={anchor}
            fontFamily="Cairo, Tahoma, sans-serif"
          >
            {object.text}
          </text>
        );
      })}
    </svg>
  );
}
