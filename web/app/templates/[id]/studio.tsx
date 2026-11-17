'use client';

import Link from 'next/link';
import { PointerEvent as ReactPointerEvent, Ref, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  HANDLES,
  FORMATS,
  Box,
  Guide,
  Handle,
  TemplateDocument,
  TemplateObject,
  TemplateText,
  TextRole,
  ToolKind,
  canChangeRole,
  canRemove,
  clamp,
  collectTargets,
  createObject,
  duplicateObject,
  normalizeColor,
  objectBounds,
  objectLabel,
  reorder,
  resizeBox,
  snapMove,
  snapResize,
} from '../model';

type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

type Drag = {
  mode: 'move' | 'resize';
  handle?: Handle;
  index: number;
  startX: number;
  startY: number;
  origin: Box;
  object: TemplateObject;
  snapshot: TemplateDocument;
  moved: boolean;
};

export function Studio({
  name,
  published,
  template,
  notice,
  error,
  saving,
  onName,
  onPublished,
  onTemplate,
  onSave,
}: {
  name: string;
  published: boolean;
  template: TemplateDocument;
  notice: string;
  error: string;
  saving: boolean;
  onName: (value: string) => void;
  onPublished: (value: boolean) => void;
  onTemplate: (value: TemplateDocument) => void;
  onSave: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ w: 960, h: 720 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [space, setSpace] = useState(false);
  const [dropReady, setDropReady] = useState(false);
  const [hint, setHint] = useState('');
  const [hist, setHist] = useState(0);
  const [heights, setHeights] = useState<number[]>([]);
  const [layerFrom, setLayerFrom] = useState<number | null>(null);
  const [layerOver, setLayerOver] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef(template);
  const onTemplateRef = useRef(onTemplate);
  const onSaveRef = useRef(onSave);
  const heightsRef = useRef<number[]>([]);
  const measureRefs = useRef(new Map<number, HTMLElement>());
  const dragRef = useRef<Drag | null>(null);
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const spaceRef = useRef(false);
  const pastRef = useRef<TemplateDocument[]>([]);
  const futureRef = useRef<TemplateDocument[]>([]);
  const draftRef = useRef<TemplateDocument | null>(null);
  const coalesceRef = useRef<TemplateDocument | null>(null);
  const coalesceTimer = useRef<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const editingRef = useRef<number | null>(null);
  const inlineRef = useRef<HTMLTextAreaElement>(null);

  templateRef.current = template;
  onTemplateRef.current = onTemplate;
  onSaveRef.current = onSave;
  selectedRef.current = selected;
  editingRef.current = editing;

  const fit =
    viewport.w > 80 && viewport.h > 80
      ? Math.min((viewport.w - 96) / template.width, (viewport.h - 96) / template.height)
      : 0.35;
  const scale = clamp(fit * zoom, 0.05, 3);
  const selectedIndex = selected != null && template.objects[selected] ? selected : null;
  const selectedObject = selectedIndex != null ? template.objects[selectedIndex] : null;

  function preview(next: TemplateDocument) {
    templateRef.current = next;
    onTemplateRef.current(next);
  }

  function pushPast(snapshot: TemplateDocument) {
    pastRef.current.push(snapshot);
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
    setHist((value) => value + 1);
  }

  function flushCoalesce() {
    if (coalesceTimer.current != null) {
      window.clearTimeout(coalesceTimer.current);
      coalesceTimer.current = null;
    }
    const base = coalesceRef.current;
    coalesceRef.current = null;
    if (base && JSON.stringify(base) !== JSON.stringify(templateRef.current)) pushPast(base);
  }

  function commit(next: TemplateDocument) {
    flushCoalesce();
    const current = templateRef.current;
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    pushPast(structuredClone(current));
    preview(next);
  }

  function remember() {
    if (!draftRef.current) draftRef.current = structuredClone(templateRef.current);
  }

  function commitDraft() {
    const base = draftRef.current;
    draftRef.current = null;
    if (base && JSON.stringify(base) !== JSON.stringify(templateRef.current)) pushPast(base);
  }

  function undo() {
    flushCoalesce();
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(structuredClone(templateRef.current));
    preview(prev);
    setHist((value) => value + 1);
  }

  function redo() {
    flushCoalesce();
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(structuredClone(templateRef.current));
    preview(next);
    setHist((value) => value + 1);
  }

  function docPoint(clientX: number, clientY: number) {
    const node = artboardRef.current;
    const current = templateRef.current;
    if (!node) return { x: 0, y: 0 };
    const rect = node.getBoundingClientRect();
    return {
      x: rect.width ? ((clientX - rect.left) / rect.width) * current.width : 0,
      y: rect.height ? ((clientY - rect.top) / rect.height) * current.height : 0,
    };
  }

  function replaceObject(index: number, object: TemplateObject, record: boolean) {
    const current = templateRef.current;
    const next = { ...current, objects: current.objects.map((item, itemIndex) => (itemIndex === index ? object : item)) };
    if (record) commit(next);
    else preview(next);
  }

  function addAt(kind: ToolKind, x: number, y: number) {
    const objects = [...templateRef.current.objects, createObject(kind, x, y)];
    commit({ ...templateRef.current, objects });
    setSelected(objects.length - 1);
    setEditing(null);
    setHint('');
  }

  function duplicateSelected() {
    const index = selectedRef.current;
    const current = templateRef.current;
    const object = index == null ? null : current.objects[index];
    if (index == null || !object) return;
    const objects = current.objects.slice();
    objects.splice(index + 1, 0, duplicateObject(object));
    commit({ ...current, objects });
    setSelected(index + 1);
  }

  function removeSelected() {
    const index = selectedRef.current;
    const current = templateRef.current;
    if (index == null) return;
    if (!canRemove(current.objects, index)) {
      setHint('أبقِ عنواناً ونصاً وزرّاً في القالب.');
      return;
    }
    const objects = current.objects.filter((_, item) => item !== index);
    commit({ ...current, objects });
    setSelected(objects.length ? Math.min(index, objects.length - 1) : null);
    setEditing(null);
    setHint('');
  }

  function moveLayer(step: number) {
    const index = selectedRef.current;
    const current = templateRef.current;
    if (index == null) return;
    const target = index + step;
    if (target < 0 || target >= current.objects.length) return;
    commit({ ...current, objects: reorder(current.objects, index, target) });
    setSelected(target);
  }

  function align(kind: Align) {
    const index = selectedRef.current;
    const current = templateRef.current;
    const object = index == null ? null : current.objects[index];
    if (index == null || !object) return;
    const box = objectBounds(object, heightsRef.current[index] ?? 0);
    const x = kind === 'left' ? 0 : kind === 'right' ? current.width - box.width : kind === 'center' ? (current.width - box.width) / 2 : object.x;
    const y = kind === 'top' ? 0 : kind === 'bottom' ? current.height - box.height : kind === 'middle' ? (current.height - box.height) / 2 : object.y;
    replaceObject(index, { ...object, x: Math.round(x), y: Math.round(y) }, true);
  }

  function nudge(dx: number, dy: number) {
    const index = selectedRef.current;
    const current = templateRef.current;
    const object = index == null ? null : current.objects[index];
    if (index == null || !object) return;
    if (!coalesceRef.current) coalesceRef.current = structuredClone(current);
    preview({
      ...current,
      objects: current.objects.map((item, itemIndex) => (itemIndex === index ? { ...item, x: item.x + dx, y: item.y + dy } : item)),
    });
    if (coalesceTimer.current != null) window.clearTimeout(coalesceTimer.current);
    coalesceTimer.current = window.setTimeout(() => flushCoalesce(), 320);
  }

  function beginDrag(event: ReactPointerEvent, index: number, mode: 'move' | 'resize', handle?: Handle) {
    if (event.button !== 0 || spaceRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    flushCoalesce();
    const object = templateRef.current.objects[index];
    if (!object) return;
    const point = docPoint(event.clientX, event.clientY);
    setSelected(index);
    setEditing((current) => (current === index ? current : null));
    setHint('');
    dragRef.current = {
      mode,
      handle,
      index,
      startX: point.x,
      startY: point.y,
      origin: objectBounds(object, heightsRef.current[index] ?? 0),
      object: structuredClone(object),
      snapshot: structuredClone(templateRef.current),
      moved: false,
    };
  }

  useLayoutEffect(() => {
    const next = template.objects.map((object, index) => {
      if (object.type !== 'text') return 0;
      const node = measureRefs.current.get(index);
      if (node instanceof HTMLTextAreaElement) {
        const previous = node.style.height;
        node.style.height = '0px';
        const full = node.scrollHeight;
        node.style.height = previous;
        return full;
      }
      return node?.offsetHeight ?? object.fontSize * 1.35;
    });
    heightsRef.current = next;
    setHeights((prev) => (prev.length === next.length && prev.every((value, index) => value === next[index]) ? prev : next));
  }, [template, editing]);

  useEffect(() => {
    if (editing != null) inlineRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => setViewport({ w: stage.clientWidth, h: stage.clientHeight }));
    observer.observe(stage);
    setViewport({ w: stage.clientWidth, h: stage.clientHeight });
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) => clamp(current * (event.deltaY > 0 ? 0.92 : 1.08), 0.15, 12));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      observer.disconnect();
      stage.removeEventListener('wheel', onWheel);
    };
  }, []);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const stage = stageRef.current;
      if (panRef.current && stage) {
        stage.scrollLeft = panRef.current.left - (event.clientX - panRef.current.x);
        stage.scrollTop = panRef.current.top - (event.clientY - panRef.current.y);
        return;
      }
      const drag = dragRef.current;
      const node = artboardRef.current;
      if (!drag || !node) return;
      const rect = node.getBoundingClientRect();
      const current = drag.snapshot;
      const point = {
        x: rect.width ? ((event.clientX - rect.left) / rect.width) * current.width : 0,
        y: rect.height ? ((event.clientY - rect.top) / rect.height) * current.height : 0,
      };
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      if (!drag.moved) {
        const pixel = rect.width && current.width ? rect.width / current.width : 1;
        if (Math.hypot(dx * pixel, dy * pixel) < 3) return;
        drag.moved = true;
      }
      const others = current.objects.flatMap((object, index) => (index === drag.index ? [] : [objectBounds(object, heightsRef.current[index] ?? 0)]));
      const threshold = rect.width && current.width ? (7 * current.width) / rect.width : 7;
      const result = applyDrag(drag, dx, dy, event.shiftKey, event.altKey, others, threshold);
      setGuides(result.guides);
      templateRef.current = result.template;
      onTemplateRef.current(result.template);
    }
    function onPointerUp() {
      panRef.current = null;
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setGuides([]);
      if (!drag.moved) return;
      pastRef.current.push(drag.snapshot);
      if (pastRef.current.length > 100) pastRef.current.shift();
      futureRef.current = [];
      setHist((value) => value + 1);
    }
    function onKeyDown(event: KeyboardEvent) {
      const typing = isTyping(event.target);
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.code === 'KeyS') {
        event.preventDefault();
        onSaveRef.current();
        return;
      }
      if (meta && event.code === 'KeyZ') {
        if (typing) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.code === 'KeyY') {
        event.preventDefault();
        redo();
        return;
      }
      if (event.code === 'Space') {
        if (typing || event.repeat) return;
        event.preventDefault();
        spaceRef.current = true;
        setSpace(true);
        return;
      }
      if (typing) return;
      if (meta && event.code === 'KeyD') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeSelected();
        return;
      }
      if (event.key === 'Escape') {
        if (dragRef.current) {
          templateRef.current = dragRef.current.snapshot;
          onTemplateRef.current(dragRef.current.snapshot);
          dragRef.current = null;
          setGuides([]);
          return;
        }
        setEditing(null);
        setSelected(null);
        return;
      }
      if (event.code === 'BracketRight') {
        moveLayer(1);
        return;
      }
      if (event.code === 'BracketLeft') {
        moveLayer(-1);
        return;
      }
      const step = event.shiftKey ? 10 : 1;
      if (event.code === 'ArrowLeft') nudge(-step, 0);
      else if (event.code === 'ArrowRight') nudge(step, 0);
      else if (event.code === 'ArrowUp') nudge(0, -step);
      else if (event.code === 'ArrowDown') nudge(0, step);
      else return;
      event.preventDefault();
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      spaceRef.current = false;
      setSpace(false);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (coalesceTimer.current != null) window.clearTimeout(coalesceTimer.current);
    };
  }, []);

  const formatId = FORMATS.find((format) => format.width === template.width && format.height === template.height)?.id ?? '';
  const canDelete = selectedIndex != null && canRemove(template.objects, selectedIndex);

  return (
    <div className="studio">
      <header className="studio-top">
        <Link href="/templates" className="back">
          القوالب
        </Link>
        <input className="studio-name" aria-label="اسم القالب" value={name} onChange={(event) => onName(event.target.value)} />
        <span className={`studio-note${error ? ' error' : ''}`}>{error || notice}</span>
        <span className="spacer" />
        <div className="cluster">
          <button type="button" className="cluster-btn" disabled={!pastRef.current.length} onClick={undo} title="تراجع">
            تراجع
          </button>
          <button type="button" className="cluster-btn" disabled={!futureRef.current.length} onClick={redo} title="إعادة">
            إعادة
          </button>
          <button type="button" className="cluster-btn" onClick={() => setZoom((current) => clamp(current / 1.1, 0.15, 12))} title="تصغير">
            −
          </button>
          <button type="button" className="zoom-readout" onClick={() => setZoom(1)} title="ملاءمة اللوحة">
            {Math.round(scale * 100)}%
          </button>
          <button type="button" className="cluster-btn" onClick={() => setZoom((current) => clamp(current * 1.1, 0.15, 12))} title="تكبير">
            +
          </button>
        </div>
        <label className="publish-toggle">
          <input type="checkbox" checked={published} onChange={(event) => onPublished(event.target.checked)} />
          منشور
        </label>
        <button type="button" className="save" onClick={onSave} disabled={saving}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
      </header>
      <div className="studio-body">
        <aside className="studio-tools">
          <div>
            <p className="studio-section">أضف عنصراً</p>
            <div className="tool-grid">
              <ToolButton kind="text" label="نص" onAdd={() => addAt('text', template.width / 2, template.height / 2)} />
              <ToolButton kind="rect" label="شكل" onAdd={() => addAt('rect', template.width / 2, template.height / 2)} />
              <ToolButton kind="logo" label="شعار" onAdd={() => addAt('logo', template.width / 2, template.height / 2)} />
            </div>
            <p className="tool-hint">اسحب إلى اللوحة أو انقر للإضافة</p>
          </div>
          <label>
            المقاس
            <select
              value={formatId}
              onChange={(event) => {
                const format = FORMATS.find((item) => item.id === event.target.value);
                if (!format) return;
                commit({ ...templateRef.current, width: format.width, height: format.height });
              }}
            >
              {formatId ? null : <option value="">مخصص</option>}
              {FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label} {format.width}×{format.height}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="studio-section">خلفية اللوحة</p>
            <ColorField
              value={template.background}
              onChange={(background) => preview({ ...templateRef.current, background })}
              onFocus={remember}
              onBlur={commitDraft}
            />
          </div>
          <div className="layer-scroll">
            <p className="studio-section">الطبقات</p>
            <div className="layer-list">
              {template.objects.map((_, index) => index).reverse().map((index) => {
                const item = template.objects[index];
                return (
                  <button
                    key={index}
                    type="button"
                    draggable
                    className={`layer${index === selectedIndex ? ' active' : ''}${layerOver === index ? ' over' : ''}`}
                    onClick={() => {
                      setSelected(index);
                      setEditing(null);
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', `layer:${index}`);
                      event.dataTransfer.effectAllowed = 'move';
                      setLayerFrom(index);
                    }}
                    onDragEnd={() => {
                      setLayerFrom(null);
                      setLayerOver(null);
                    }}
                    onDragOver={(event) => {
                      if (layerFrom == null) return;
                      event.preventDefault();
                      setLayerOver(index);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const from = layerFrom;
                      setLayerFrom(null);
                      setLayerOver(null);
                      if (from == null || from === index) return;
                      commit({ ...templateRef.current, objects: reorder(templateRef.current.objects, from, index) });
                      setSelected(index);
                    }}
                  >
                    <span>{objectLabel(item)}</span>
                    {item.type === 'text' && item.role !== 'static' ? <em>تاجر</em> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
        <div
          ref={stageRef}
          className={`studio-stage${space ? ' space' : ''}`}
          onPointerDownCapture={(event) => {
            if (event.button !== 1 && !spaceRef.current) return;
            event.preventDefault();
            event.stopPropagation();
            const stage = stageRef.current;
            if (!stage) return;
            panRef.current = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
          }}
          onDragOver={(event) => {
            if (!Array.from(event.dataTransfer.types).includes('application/x-autopost-tool')) return;
            event.preventDefault();
            setDropReady(true);
          }}
          onDragLeave={(event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node) || !event.currentTarget.contains(next)) setDropReady(false);
          }}
          onDrop={(event) => {
            setDropReady(false);
            const kind = readTool(event);
            if (!kind) return;
            event.preventDefault();
            const point = docPoint(event.clientX, event.clientY);
            addAt(kind, point.x, point.y);
          }}
        >
          <div className="stage-center">
            <div className={`artboard-slot${dropReady ? ' drop-ready' : ''}`} style={{ width: template.width * scale, height: template.height * scale }}>
              <div ref={artboardRef} className="artboard" style={{ width: template.width, height: template.height, transform: `scale(${scale})` }}>
                <div
                  className="artboard-clip"
                  style={{ background: template.background }}
                  onPointerDown={(event) => {
                    if (event.target !== event.currentTarget || event.button !== 0) return;
                    setSelected(null);
                    setEditing(null);
                  }}
                >
                  {template.objects.map((object, index) => (
                    <CanvasObject
                      key={index}
                      object={object}
                      index={index}
                      editing={editing === index}
                      boxHeight={heights[index] ?? 0}
                      inlineRef={editing === index ? inlineRef : undefined}
                      measure={(node) => {
                        if (node) measureRefs.current.set(index, node);
                        else measureRefs.current.delete(index);
                      }}
                      onPointerDown={(event) => beginDrag(event, index, 'move')}
                      onDoubleClick={() => {
                        dragRef.current = null;
                        if (object.type !== 'text') return;
                        setSelected(index);
                        setEditing(index);
                      }}
                      onText={(text) => replaceObject(index, { ...(object as TemplateText), text }, false)}
                      onTextFocus={remember}
                      onTextBlur={() => {
                        commitDraft();
                        setEditing(null);
                      }}
                    />
                  ))}
                  {guides.map((guide, index) => (
                    <div
                      key={`${guide.axis}-${index}`}
                      className={guide.axis === 'x' ? 'guide-x' : 'guide-y'}
                      style={guide.axis === 'x' ? { left: guide.at, width: 1 / scale } : { top: guide.at, height: 1 / scale }}
                    />
                  ))}
                </div>
                {selectedObject && selectedIndex != null ? (
                  <Selection
                    box={objectBounds(selectedObject, heights[selectedIndex] ?? 0)}
                    scale={scale}
                    showHandles={editing !== selectedIndex}
                    onResize={(event, handle) => beginDrag(event, selectedIndex, 'resize', handle)}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <aside className="studio-inspector">
          {selectedObject && selectedIndex != null ? (
            <Inspector
              template={template}
              index={selectedIndex}
              object={selectedObject}
              hint={hint}
              canDelete={canDelete}
              atFront={selectedIndex === template.objects.length - 1}
              atBack={selectedIndex === 0}
              onChange={(object) => replaceObject(selectedIndex, object, false)}
              onFocus={remember}
              onBlur={commitDraft}
              onCommit={(object) => replaceObject(selectedIndex, object, true)}
              onAlign={align}
              onDuplicate={duplicateSelected}
              onForward={() => moveLayer(1)}
              onBackward={() => moveLayer(-1)}
              onDelete={removeSelected}
              onRoleBlocked={() => setHint('أبقِ عنواناً ونصاً وزرّاً في القالب.')}
            />
          ) : (
            <div className="empty-inspector">
              <strong>اللوحة</strong>
              <p>اسحب العناصر على التصميم. انقر مرتين لتعديل النص.</p>
              <ul>
                <li>الأسهم تحرّك العنصر، و Shift يسرّعها</li>
                <li>Shift أثناء تغيير الحجم يثبّت النسبة</li>
                <li>Alt يلغي المحاذاة الذكية</li>
                <li>المسافة ثم السحب تحرّك نظرك على اللوحة</li>
                <li>Ctrl+Z تراجع، Ctrl+D تكرار، Ctrl+S حفظ</li>
              </ul>
            </div>
          )}
        </aside>
      </div>
      <span className="sr-only" data-history={hist} />
    </div>
  );
}

function ToolButton({ kind, label, onAdd }: { kind: ToolKind; label: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      className="tool"
      draggable
      onClick={onAdd}
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-autopost-tool', kind);
        event.dataTransfer.setData('text/plain', `tool:${kind}`);
        event.dataTransfer.effectAllowed = 'copy';
      }}
    >
      {kind === 'text' ? <TextGlyph /> : kind === 'rect' ? <RectGlyph /> : <LogoGlyph />}
      {label}
    </button>
  );
}

function CanvasObject({
  object,
  index,
  editing,
  boxHeight,
  inlineRef,
  measure,
  onPointerDown,
  onDoubleClick,
  onText,
  onTextFocus,
  onTextBlur,
}: {
  object: TemplateObject;
  index: number;
  editing: boolean;
  boxHeight: number;
  inlineRef?: Ref<HTMLTextAreaElement>;
  measure: (node: HTMLElement | null) => void;
  onPointerDown: (event: ReactPointerEvent) => void;
  onDoubleClick: () => void;
  onText: (value: string) => void;
  onTextFocus: () => void;
  onTextBlur: () => void;
}) {
  if (object.type === 'text') {
    const shared = {
      left: object.x,
      top: object.y,
      width: object.width,
      fontSize: object.fontSize,
      fontWeight: object.fontWeight,
      color: object.fill,
      textAlign: object.align,
      lineHeight: 1.35,
      fontFamily: 'Cairo, Tahoma, sans-serif',
      direction: 'rtl' as const,
    };
    if (editing) {
      return (
        <textarea
          ref={(node) => {
            measure(node);
            if (typeof inlineRef === 'function') inlineRef(node);
            else if (inlineRef && 'current' in inlineRef) (inlineRef as { current: HTMLTextAreaElement | null }).current = node;
          }}
          className="inline-editor"
          value={object.text}
          style={{ ...shared, height: Math.max(boxHeight, object.fontSize * 1.2) }}
          onChange={(event) => onText(event.target.value)}
          onFocus={onTextFocus}
          onBlur={onTextBlur}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') event.currentTarget.blur();
          }}
        />
      );
    }
    return (
      <div
        ref={measure}
        className="canvas-object text-layer"
        role="button"
        aria-label={objectLabel(object)}
        style={shared}
        onPointerDown={onPointerDown}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onDoubleClick();
        }}
      >
        {object.text || ' '}
      </div>
    );
  }
  if (object.type === 'rect') {
    return (
      <div
        className="canvas-object"
        role="button"
        aria-label="شكل"
        style={{ left: object.x, top: object.y, width: object.width, height: object.height, background: object.fill, borderRadius: object.radius }}
        onPointerDown={onPointerDown}
      />
    );
  }
  return (
    <div
      className="canvas-object logo-layer"
      role="button"
      aria-label="الشعار"
      style={{ left: object.x, top: object.y, width: object.width, height: object.height }}
      onPointerDown={onPointerDown}
    >
      <LogoGlyph />
    </div>
  );
}

function Selection({
  box,
  scale,
  showHandles,
  onResize,
}: {
  box: Box;
  scale: number;
  showHandles: boolean;
  onResize: (event: ReactPointerEvent, handle: Handle) => void;
}) {
  const size = 8 / scale;
  return (
    <div
      className="selection-box"
      style={{ left: box.x, top: box.y, width: box.width, height: box.height, boxShadow: `0 0 0 ${1.5 / scale}px #1d6fe8` }}
    >
      {showHandles
        ? HANDLES.map((handle) => (
            <span
              key={handle}
              className={`handle handle-${handle}`}
              style={{ width: size, height: size, borderWidth: 1.5 / scale }}
              onPointerDown={(event) => onResize(event, handle)}
            />
          ))
        : null}
    </div>
  );
}

function Inspector({
  template,
  index,
  object,
  hint,
  canDelete,
  atFront,
  atBack,
  onChange,
  onCommit,
  onFocus,
  onBlur,
  onAlign,
  onDuplicate,
  onForward,
  onBackward,
  onDelete,
  onRoleBlocked,
}: {
  template: TemplateDocument;
  index: number;
  object: TemplateObject;
  hint: string;
  canDelete: boolean;
  atFront: boolean;
  atBack: boolean;
  onChange: (object: TemplateObject) => void;
  onCommit: (object: TemplateObject) => void;
  onFocus: () => void;
  onBlur: () => void;
  onAlign: (kind: Align) => void;
  onDuplicate: () => void;
  onForward: () => void;
  onBackward: () => void;
  onDelete: () => void;
  onRoleBlocked: () => void;
}) {
  return (
    <>
      <div className="inspector-head">
        <strong>{objectLabel(object)}</strong>
        <div className="segment">
          <button type="button" className="segment-btn" onClick={onDuplicate}>
            تكرار
          </button>
          <button type="button" className="segment-btn" disabled={atFront} onClick={onForward}>
            أمام
          </button>
          <button type="button" className="segment-btn" disabled={atBack} onClick={onBackward}>
            خلف
          </button>
        </div>
      </div>
      {object.type === 'text' ? (
        <>
          <label>
            الدور
            <select
              value={object.role}
              onFocus={onFocus}
              onBlur={onBlur}
              onChange={(event) => {
                const role = event.target.value as TextRole;
                if (!canChangeRole(template.objects, index, role)) {
                  onRoleBlocked();
                  return;
                }
                onChange({ ...object, role });
              }}
            >
              <option value="headline">العنوان</option>
              <option value="caption">النص</option>
              <option value="cta">الزر</option>
              <option value="static">نص ثابت</option>
            </select>
          </label>
          {object.role === 'static' ? null : <p className="tool-hint">يُستبدل هذا النص بنص التاجر عند النشر.</p>}
          <label>
            النص
            <textarea
              value={object.text}
              onFocus={onFocus}
              onBlur={onBlur}
              onChange={(event) => onChange({ ...object, text: event.target.value.slice(0, 500) })}
            />
          </label>
          <ColorField value={object.fill} onChange={(fill) => onChange({ ...object, fill })} onFocus={onFocus} onBlur={onBlur} />
          <label>
            الحجم {object.fontSize}
            <input
              type="range"
              min={8}
              max={320}
              value={object.fontSize}
              onFocus={onFocus}
              onBlur={onBlur}
              onChange={(event) => onChange({ ...object, fontSize: Number(event.target.value) })}
            />
          </label>
          <div className="segment">
            <button type="button" className={`segment-btn${object.fontWeight === '400' ? ' active' : ''}`} onClick={() => onCommit({ ...object, fontWeight: '400' })}>
              عادي
            </button>
            <button type="button" className={`segment-btn${object.fontWeight === '700' ? ' active' : ''}`} onClick={() => onCommit({ ...object, fontWeight: '700' })}>
              عريض
            </button>
          </div>
          <div className="segment">
            <button type="button" className={`segment-btn${object.align === 'right' ? ' active' : ''}`} onClick={() => onCommit({ ...object, align: 'right' })}>
              يمين
            </button>
            <button type="button" className={`segment-btn${object.align === 'center' ? ' active' : ''}`} onClick={() => onCommit({ ...object, align: 'center' })}>
              وسط
            </button>
            <button type="button" className={`segment-btn${object.align === 'left' ? ' active' : ''}`} onClick={() => onCommit({ ...object, align: 'left' })}>
              يسار
            </button>
          </div>
        </>
      ) : null}
      {object.type === 'rect' ? (
        <>
          <ColorField value={object.fill} onChange={(fill) => onChange({ ...object, fill })} onFocus={onFocus} onBlur={onBlur} />
          <NumberField label="الاستدارة" value={object.radius} onChange={(radius) => onChange({ ...object, radius: clamp(radius, 0, 1000) })} onFocus={onFocus} onBlur={onBlur} />
        </>
      ) : null}
      <div className="field-grid">
        <NumberField label="أفقي" value={object.x} onChange={(x) => onChange({ ...object, x })} onFocus={onFocus} onBlur={onBlur} />
        <NumberField label="رأسي" value={object.y} onChange={(y) => onChange({ ...object, y })} onFocus={onFocus} onBlur={onBlur} />
        <NumberField
          label="العرض"
          value={object.width}
          onChange={(width) => onChange({ ...object, width: Math.max(object.type === 'text' ? 20 : object.type === 'image' ? 16 : 4, width) })}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {object.type === 'text' ? null : (
          <NumberField
            label="الارتفاع"
            value={object.height}
            onChange={(height) => onChange({ ...object, height: Math.max(object.type === 'image' ? 16 : 4, height) })}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        )}
      </div>
      <p className="studio-section">محاذاة باللوحة</p>
      <div className="segment">
        <button type="button" className="segment-btn" onClick={() => onAlign('right')}>
          يمين
        </button>
        <button type="button" className="segment-btn" onClick={() => onAlign('center')}>
          وسط
        </button>
        <button type="button" className="segment-btn" onClick={() => onAlign('left')}>
          يسار
        </button>
      </div>
      <div className="segment">
        <button type="button" className="segment-btn" onClick={() => onAlign('top')}>
          أعلى
        </button>
        <button type="button" className="segment-btn" onClick={() => onAlign('middle')}>
          منتصف
        </button>
        <button type="button" className="segment-btn" onClick={() => onAlign('bottom')}>
          أسفل
        </button>
      </div>
      {hint ? <p className="error">{hint}</p> : null}
      <button type="button" className="danger" disabled={!canDelete} onClick={onDelete}>
        حذف
      </button>
    </>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? Math.round(value) : 0}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

function ColorField({ value, onChange, onFocus, onBlur }: { value: string; onChange: (value: string) => void; onFocus: () => void; onBlur: () => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <label>
      اللون
      <span className="color-row">
        <input
          type="color"
          value={swatch}
          aria-label="اختيار اللون"
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          value={text}
          aria-label="قيمة اللون"
          onFocus={onFocus}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => {
            const next = normalizeColor(text, value);
            setText(next);
            if (next !== value) onChange(next);
            onBlur();
          }}
        />
      </span>
    </label>
  );
}

function TextGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h14M12 6v12M8.5 18h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RectGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LogoGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.2" fill="currentColor" />
      <path d="M7.2 17.2c.8-2.2 2.4-3.2 4.8-3.2s4 .1 4.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function readTool(event: { dataTransfer: DataTransfer }): ToolKind | null {
  const custom = event.dataTransfer.getData('application/x-autopost-tool');
  const plain = event.dataTransfer.getData('text/plain');
  const kind = custom || (plain.startsWith('tool:') ? plain.slice(5) : '');
  if (kind === 'text' || kind === 'rect' || kind === 'logo') return kind;
  return null;
}

function resizeText(object: TemplateText, origin: Box, handle: Handle, dx: number, dy: number, lock: boolean): TemplateText {
  const box = resizeBox(origin, handle, dx, dy, false, 20, 8);
  if (handle === 'e' || handle === 'w') {
    return { ...object, x: Math.round(box.x), width: Math.round(Math.max(20, box.width)) };
  }
  const ratio = origin.height > 0 ? box.height / origin.height : 1;
  let fontSize = clamp(Math.round(object.fontSize * ratio), 8, 320);
  let width = object.width;
  let x = object.x;
  if (handle.includes('e') || handle.includes('w')) {
    width = Math.round(Math.max(20, box.width));
    x = Math.round(box.x);
    if (lock && object.width > 0) fontSize = clamp(Math.round(object.fontSize * (width / object.width)), 8, 320);
  }
  const y = handle.includes('n') ? Math.round(box.y) : object.y;
  return { ...object, x, y, width, fontSize };
}

function applyDrag(drag: Drag, dx: number, dy: number, lock: boolean, nosnap: boolean, others: Box[], threshold: number): { template: TemplateDocument; guides: Guide[] } {
  const canvas = { width: drag.snapshot.width, height: drag.snapshot.height };
  const targets = collectTargets(others, canvas);
  let guides: Guide[] = [];
  let next: TemplateObject = drag.object;
  if (drag.mode === 'move') {
    const proposed = { x: drag.origin.x + dx, y: drag.origin.y + dy, width: drag.origin.width, height: drag.origin.height };
    const snapped = nosnap ? { box: proposed, guides: [] as Guide[] } : snapMove(proposed, targets.xs, targets.ys, threshold);
    guides = snapped.guides;
    next = { ...drag.object, x: Math.round(snapped.box.x), y: Math.round(snapped.box.y) };
  } else if (drag.object.type === 'text') {
    const handle = drag.handle ?? 'se';
    const resized = resizeText(drag.object, drag.origin, handle, dx, dy, lock);
    if (!nosnap && !lock && (handle === 'e' || handle === 'w')) {
      const snapped = snapResize(
        drag.origin,
        handle,
        { x: resized.x, y: drag.origin.y, width: resized.width, height: drag.origin.height },
        targets.xs,
        targets.ys,
        threshold,
        20,
      );
      guides = snapped.guides;
      next = { ...resized, x: Math.round(snapped.box.x), width: Math.round(snapped.box.width) };
    } else {
      next = resized;
    }
  } else {
    const handle = drag.handle ?? 'se';
    const min = drag.object.type === 'image' ? 16 : 4;
    let box = resizeBox(drag.origin, handle, dx, dy, lock, min, min);
    if (!nosnap && !lock) {
      const snapped = snapResize(drag.origin, handle, box, targets.xs, targets.ys, threshold, min);
      box = snapped.box;
      guides = snapped.guides;
    }
    next = { ...drag.object, x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
  }
  return {
    guides,
    template: {
      ...drag.snapshot,
      objects: drag.snapshot.objects.map((object, index) => (index === drag.index ? next : object)),
    },
  };
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
