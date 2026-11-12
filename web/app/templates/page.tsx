'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Template = { id: string; name: string; published: boolean; updatedAt: string };

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/nest/templates');
    if (response.status === 401) {
      setError('افتح رابط الاستوديو من واتساب أولاً.');
      return;
    }
    setTemplates(await response.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTemplate() {
    const response = await fetch('/api/nest/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'قالب جديد' }),
    });
    if (!response.ok) {
      setError('تعذر إنشاء القالب.');
      return;
    }
    const created = (await response.json()) as Template;
    router.push(`/templates/${created.id}`);
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">القوالب</h1>
          <p className="lede">يصمم الفريق القالب هنا، ثم ينشره ليستخدمه التجار في منشوراتهم.</p>
        </div>
        <button type="button" onClick={() => void createTemplate()}>
          قالب جديد
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="grid">
        {templates.map((template) => (
          <Link key={template.id} href={`/templates/${template.id}`} className="template-card">
            <strong>{template.name}</strong>
            <p className="muted">{template.published ? 'منشور للتجار' : 'مسودة'}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
