'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TemplateDocument } from '../model';
import { Studio } from './studio';

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [name, setName] = useState('');
  const [published, setPublished] = useState(false);
  const [template, setTemplate] = useState<TemplateDocument | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch(`/api/nest/templates/${id}`)
      .then(async (response) => {
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
        setTemplate(body.document);
      })
      .catch(() => setError('تعذر فتح القالب.'));
  }, [id]);

  async function save() {
    if (!template) return;
    setError('');
    setNotice('جارٍ الحفظ…');
    setSaving(true);
    try {
      const response = await fetch(`/api/nest/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, published, document: template }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setNotice('');
        setError(body.message || 'تعذر حفظ القالب.');
        return;
      }
      setNotice(published ? 'تم الحفظ. القالب منشور للتجار.' : 'تم الحفظ كمسودة.');
    } catch {
      setNotice('');
      setError('تعذر حفظ القالب.');
    } finally {
      setSaving(false);
    }
  }

  if (!template) {
    return (
      <>
        <h1 className="page-title">تعديل القالب</h1>
        <p className={error ? 'error' : undefined}>{error || 'جارٍ فتح القالب…'}</p>
      </>
    );
  }

  return (
    <Studio
      name={name}
      published={published}
      template={template}
      notice={notice}
      error={error}
      saving={saving}
      onName={setName}
      onPublished={setPublished}
      onTemplate={setTemplate}
      onSave={() => void save()}
    />
  );
}
