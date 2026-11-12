'use client';

import { FormEvent, useEffect, useState } from 'react';

type Brand = {
  name: string;
  industry: string;
  website: string;
  primaryColor: string;
  description: string;
  tone: string;
  audience: string;
  logoUrl: string;
};

const empty: Brand = {
  name: '',
  industry: '',
  website: '',
  primaryColor: '#0f2744',
  description: '',
  tone: 'professional',
  audience: '',
  logoUrl: '',
};

export default function BrandPage() {
  const [brand, setBrand] = useState<Brand>(empty);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/nest/brand').then(async (response) => {
      if (!response.ok) {
        setError('افتح رابط الاستوديو من واتساب أولاً.');
        return;
      }
      setBrand(await response.json());
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/nest/brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brand),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.message || 'تعذر حفظ العلامة.');
      return;
    }
    setBrand(await response.json());
  }

  async function upload(file: File) {
    const dataBase64 = await fileToBase64(file);
    const response = await fetch('/api/nest/brand/logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataBase64 }),
    });
    if (!response.ok) {
      setError('تعذر رفع الشعار.');
      return;
    }
    setBrand(await response.json());
  }

  return (
    <section>
      <h1>علامتك</h1>
      <form onSubmit={save}>
        <label>
          اسم النشاط
          <input value={brand.name} onChange={(event) => setBrand({ ...brand, name: event.target.value })} />
        </label>
        <label>
          المجال
          <input value={brand.industry} onChange={(event) => setBrand({ ...brand, industry: event.target.value })} />
        </label>
        <label>
          الموقع
          <input value={brand.website} onChange={(event) => setBrand({ ...brand, website: event.target.value })} />
        </label>
        <label>
          اللون الأساسي
          <input value={brand.primaryColor} onChange={(event) => setBrand({ ...brand, primaryColor: event.target.value })} />
        </label>
        <label>
          الوصف
          <textarea value={brand.description} onChange={(event) => setBrand({ ...brand, description: event.target.value })} />
        </label>
        <label>
          الأسلوب
          <select value={brand.tone} onChange={(event) => setBrand({ ...brand, tone: event.target.value })}>
            <option value="professional">مهني</option>
            <option value="friendly">ودود</option>
            <option value="luxury">فاخر</option>
            <option value="educational">تعليمي</option>
          </select>
        </label>
        <label>
          الشعار
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void upload(file);
              }
            }}
          />
        </label>
        {brand.logoUrl ? <img src={brand.logoUrl} alt="الشعار" width={120} /> : null}
        <button type="submit">حفظ العلامة</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
